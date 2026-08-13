//! Best-effort thermal sensor sampling.
//!
//! Windows priority: LibreHardwareMonitor → NVML (GPU) / WMI ThermalZone + ACPI
//! (CPU) / WMI numeric probes (RAM). Non-Windows builds always return `None`.

/// Optional CPU / GPU / RAM temperatures in Celsius.
#[derive(Debug, Clone, Copy, Default)]
pub struct ThermalTemps {
    pub cpu_temp_celsius: Option<f32>,
    pub gpu_temp_celsius: Option<f32>,
    pub ram_temp_celsius: Option<f32>,
}

/// Stateful sampler: caches NVML + LHM handles across ticks.
pub struct ThermalSampler {
    #[cfg(windows)]
    inner: windows_thermal::Sampler,
}

impl ThermalSampler {
    pub fn new() -> Self {
        Self {
            #[cfg(windows)]
            inner: windows_thermal::Sampler::open(),
        }
    }

    /// Sample thermal sensors. Failures are swallowed — callers treat `None` as "—".
    pub fn sample(&mut self) -> ThermalTemps {
        #[cfg(windows)]
        {
            self.inner.sample()
        }
        #[cfg(not(windows))]
        {
            ThermalTemps::default()
        }
    }
}

impl Default for ThermalSampler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(windows)]
mod windows_thermal {
    use std::sync::atomic::{AtomicBool, Ordering};

    use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
    use nvml_wrapper::Nvml;
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    use super::ThermalTemps;
    use crate::metrics::lhm::LhmSampler;

    static LOGGED_COM_ASSUME: AtomicBool = AtomicBool::new(false);
    static LOGGED_NVML_FAIL: AtomicBool = AtomicBool::new(false);
    static LOGGED_NVML_OK: AtomicBool = AtomicBool::new(false);
    static LOGGED_LAYER: AtomicBool = AtomicBool::new(false);

    pub struct Sampler {
        /// Lazy so AppState construction stays fast and logs run after plugin-log init.
        ready: bool,
        nvml: Option<Nvml>,
        lhm: Option<LhmSampler>,
        /// WMI classes that failed once (e.g. WBEM_E_INVALID_CLASS) — do not retry every tick.
        probes: ProbeAvailability,
    }

    /// Sticky skip flags for WMI probes that are missing on this machine.
    #[derive(Default)]
    struct ProbeAvailability {
        skip_thermal_zone_perf: bool,
        skip_acpi: bool,
        skip_nvidia_thermal: bool,
        skip_numeric_sensor: bool,
        skip_temp_probe: bool,
    }

    impl Sampler {
        pub fn open() -> Self {
            Self {
                ready: false,
                nvml: None,
                lhm: None,
                probes: ProbeAvailability::default(),
            }
        }

        fn ensure_ready(&mut self) {
            if self.ready {
                return;
            }
            self.ready = true;

            self.nvml = match Nvml::init() {
                Ok(n) => {
                    if !LOGGED_NVML_OK.swap(true, Ordering::Relaxed) {
                        log::info!("NVML initialized for GPU temperature");
                    }
                    Some(n)
                }
                Err(err) => {
                    if !LOGGED_NVML_FAIL.swap(true, Ordering::Relaxed) {
                        log::info!(
                            "NVML unavailable ({err}); GPU temp will use LHM/WMI when present"
                        );
                    }
                    None
                }
            };

            self.lhm = Some(LhmSampler::open());
        }

        pub fn sample(&mut self) -> ThermalTemps {
            self.ensure_ready();

            let lhm = self
                .lhm
                .as_mut()
                .map(|s| s.sample())
                .unwrap_or_default();
            let com = init_com();
            let probes = &mut self.probes;

            let cpu = lhm
                .cpu_temp_celsius
                .or_else(|| com.and_then(|c| sample_cpu_thermal_zone_perf(c, probes)))
                .or_else(|| com.and_then(|c| sample_cpu_acpi(c, probes)));

            let gpu = lhm
                .gpu_temp_celsius
                .or_else(|| sample_gpu_nvml(self.nvml.as_ref()))
                .or_else(|| com.and_then(|c| sample_gpu_wmi(c, probes)));

            let ram = lhm
                .ram_temp_celsius
                .or_else(|| com.and_then(|c| sample_ram(c, probes)));

            if !LOGGED_LAYER.swap(true, Ordering::Relaxed) {
                log::info!(
                    "thermal sources — cpu: {} ({:?}°C) gpu: {} ({:?}°C) ram: {} ({:?}°C)",
                    source_label(lhm.cpu_temp_celsius, cpu, "lhm", "wmi"),
                    cpu,
                    source_label(lhm.gpu_temp_celsius, gpu, "lhm", "nvml/wmi"),
                    gpu,
                    source_label(lhm.ram_temp_celsius, ram, "lhm", "wmi"),
                    ram
                );
            }

            ThermalTemps {
                cpu_temp_celsius: cpu,
                gpu_temp_celsius: gpu,
                ram_temp_celsius: ram,
            }
        }
    }

    fn source_label(
        lhm: Option<f32>,
        final_v: Option<f32>,
        primary: &str,
        fallback: &str,
    ) -> String {
        match (lhm, final_v) {
            (Some(_), _) => format!("{primary}"),
            (None, Some(_)) => format!("{fallback}"),
            (None, None) => "none".to_string(),
        }
    }

    fn init_com() -> Option<COMLibrary> {
        match COMLibrary::new() {
            Ok(com) => Some(com),
            Err(err) => {
                if !LOGGED_COM_ASSUME.swap(true, Ordering::Relaxed) {
                    log::warn!(
                        "COMLibrary::new failed ({err}); assuming COM already initialized (Tauri/WebView2)"
                    );
                }
                // SAFETY: WebView2 / Tauri typically already called CoInitializeEx on this
                // thread; `new` fails with RPC_E_CHANGED_MODE / already-initialized in that case.
                Some(unsafe { COMLibrary::assume_initialized() })
            }
        }
    }

    /// Convert ACPI / perf-counter tenths-of-Kelvin to °C, rejecting implausible readings.
    fn tenths_kelvin_to_celsius(tenths: i32) -> Option<f32> {
        let celsius = (tenths as f32 / 10.0) - 273.15;
        if celsius.is_finite() && (-40.0..=150.0).contains(&celsius) {
            Some(celsius)
        } else {
            None
        }
    }

    fn max_celsius(values: impl IntoIterator<Item = f32>) -> Option<f32> {
        values
            .into_iter()
            .filter(|v| v.is_finite())
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_PerfFormattedData_Counters_ThermalZoneInformation")]
    #[serde(rename_all = "PascalCase")]
    struct ThermalZonePerf {
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        high_precision_temperature: Option<u32>,
        #[serde(default)]
        temperature: Option<u32>,
    }

    /// Prefer `Win32_PerfFormattedData_Counters_ThermalZoneInformation` (often CPUZ zones).
    fn sample_cpu_thermal_zone_perf(com: COMLibrary, probes: &mut ProbeAvailability) -> Option<f32> {
        if probes.skip_thermal_zone_perf {
            return None;
        }

        let wmi = match WMIConnection::new(com) {
            Ok(w) => w,
            Err(err) => {
                log::debug!("WMI cimv2 connect failed: {err}");
                return None;
            }
        };

        let zones: Vec<ThermalZonePerf> = match wmi.raw_query(
            "SELECT Name, HighPrecisionTemperature, Temperature FROM Win32_PerfFormattedData_Counters_ThermalZoneInformation",
        ) {
            Ok(z) => z,
            Err(err) => {
                probes.skip_thermal_zone_perf = true;
                log::debug!("ThermalZoneInformation unavailable ({err}); skipping further queries");
                return None;
            }
        };

        let mut cpu_named: Vec<f32> = Vec::new();
        let mut other: Vec<f32> = Vec::new();

        for zone in zones {
            if zone_name_suggests_gpu(zone.name.as_deref()) {
                continue;
            }
            let Some(raw) = zone
                .high_precision_temperature
                .or(zone.temperature)
                .map(|v| v as i32)
            else {
                continue;
            };
            let Some(celsius) = tenths_kelvin_to_celsius(raw) else {
                continue;
            };
            if zone_name_suggests_cpu(zone.name.as_deref()) {
                cpu_named.push(celsius);
            } else {
                other.push(celsius);
            }
        }

        max_celsius(cpu_named).or_else(|| max_celsius(other))
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename = "MSAcpi_ThermalZoneTemperature")]
    #[serde(rename_all = "PascalCase")]
    struct MsAcpiThermalZone {
        current_temperature: i32,
        #[serde(default)]
        instance_name: Option<String>,
    }

    /// CPU / package proxy: max ACPI thermal-zone reading (exclude obvious GPU names).
    fn sample_cpu_acpi(com: COMLibrary, probes: &mut ProbeAvailability) -> Option<f32> {
        if probes.skip_acpi {
            return None;
        }

        let wmi = match WMIConnection::with_namespace_path(r"ROOT\WMI", com) {
            Ok(w) => w,
            Err(err) => {
                probes.skip_acpi = true;
                log::debug!("ROOT\\WMI connect failed ({err}); skipping ACPI thermal queries");
                return None;
            }
        };
        let zones: Vec<MsAcpiThermalZone> = match wmi.query() {
            Ok(z) => z,
            Err(err) => {
                probes.skip_acpi = true;
                log::debug!(
                    "MSAcpi_ThermalZoneTemperature unavailable ({err}); skipping further queries"
                );
                return None;
            }
        };

        max_celsius(zones.into_iter().filter_map(|zone| {
            if zone_name_suggests_gpu(zone.instance_name.as_deref()) {
                return None;
            }
            tenths_kelvin_to_celsius(zone.current_temperature)
        }))
    }

    fn zone_name_suggests_cpu(name: Option<&str>) -> bool {
        let Some(name) = name else {
            return false;
        };
        let upper = name.to_ascii_uppercase();
        upper.contains("CPU")
            || upper.contains("CPUZ")
            || upper.contains("PROC")
            || upper.contains("THRM")
            || upper.contains("TZCPU")
    }

    fn zone_name_suggests_gpu(name: Option<&str>) -> bool {
        let Some(name) = name else {
            return false;
        };
        let upper = name.to_ascii_uppercase();
        upper.contains("GPU") || upper.contains("GFX") || upper.contains("VIDEO")
    }

    fn zone_name_suggests_ram(name: Option<&str>) -> bool {
        let Some(name) = name else {
            return false;
        };
        let upper = name.to_ascii_uppercase();
        upper.contains("DIMM")
            || upper.contains("DRAM")
            || upper.contains("MEMORY")
            || upper.contains("RAM")
    }

    fn sample_gpu_nvml(nvml: Option<&Nvml>) -> Option<f32> {
        let nvml = nvml?;
        let count = nvml.device_count().ok()?;
        let mut temps = Vec::with_capacity(count as usize);
        for i in 0..count {
            let Ok(device) = nvml.device_by_index(i) else {
                continue;
            };
            if let Ok(t) = device.temperature(TemperatureSensor::Gpu) {
                let c = t as f32;
                if (-40.0..=150.0).contains(&c) {
                    temps.push(c);
                }
            }
        }
        max_celsius(temps)
    }

    /// Vendor WMI GPU temps when present; otherwise thermal zones named like GPU.
    fn sample_gpu_wmi(com: COMLibrary, probes: &mut ProbeAvailability) -> Option<f32> {
        sample_nvidia_gpu(com, probes)
            .or_else(|| sample_gpu_from_thermal_zones(com, probes))
            .or_else(|| sample_gpu_from_numeric_sensors(com, probes))
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "PascalCase")]
    struct NvidiaThermalSensor {
        #[serde(default)]
        gpu_temperature: Option<i32>,
        #[serde(default)]
        current_temperature: Option<i32>,
        #[serde(default)]
        temperature: Option<i32>,
    }

    fn sample_nvidia_gpu(com: COMLibrary, probes: &mut ProbeAvailability) -> Option<f32> {
        if probes.skip_nvidia_thermal {
            return None;
        }

        let wmi = WMIConnection::with_namespace_path(r"ROOT\WMI", com).ok()?;
        let rows: Vec<NvidiaThermalSensor> = match wmi.raw_query("SELECT * FROM NVIDIA_ThermalSensor")
        {
            Ok(rows) => rows,
            Err(err) => {
                probes.skip_nvidia_thermal = true;
                log::debug!("NVIDIA_ThermalSensor unavailable ({err}); skipping further queries");
                return None;
            }
        };

        max_celsius(rows.into_iter().filter_map(|row| {
            let raw = row
                .gpu_temperature
                .or(row.current_temperature)
                .or(row.temperature)?;
            let celsius = raw as f32;
            if (-40.0..=150.0).contains(&celsius) {
                Some(celsius)
            } else {
                tenths_kelvin_to_celsius(raw)
            }
        }))
    }

    fn sample_gpu_from_thermal_zones(com: COMLibrary, probes: &mut ProbeAvailability) -> Option<f32> {
        if probes.skip_acpi {
            return None;
        }

        let wmi = WMIConnection::with_namespace_path(r"ROOT\WMI", com).ok()?;
        let zones: Vec<MsAcpiThermalZone> = match wmi.query() {
            Ok(z) => z,
            Err(err) => {
                probes.skip_acpi = true;
                log::debug!(
                    "MSAcpi_ThermalZoneTemperature unavailable ({err}); skipping further queries"
                );
                return None;
            }
        };
        max_celsius(zones.into_iter().filter_map(|zone| {
            if !zone_name_suggests_gpu(zone.instance_name.as_deref()) {
                return None;
            }
            tenths_kelvin_to_celsius(zone.current_temperature)
        }))
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename = "CIM_NumericSensor")]
    #[serde(rename_all = "PascalCase")]
    struct NumericSensor {
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        current_reading: Option<i32>,
        /// 2 = Temperature (CIM_SensorType).
        #[serde(default)]
        sensor_type: Option<u16>,
    }

    fn sample_gpu_from_numeric_sensors(
        com: COMLibrary,
        probes: &mut ProbeAvailability,
    ) -> Option<f32> {
        if probes.skip_numeric_sensor {
            return None;
        }

        let wmi = WMIConnection::new(com).ok()?;
        let sensors: Vec<NumericSensor> = match wmi.query() {
            Ok(s) => s,
            Err(err) => {
                probes.skip_numeric_sensor = true;
                log::debug!("CIM_NumericSensor unavailable ({err}); skipping further queries");
                return None;
            }
        };
        max_celsius(sensors.into_iter().filter_map(|sensor| {
            if sensor.sensor_type.is_some_and(|t| t != 2) {
                return None;
            }
            if !zone_name_suggests_gpu(sensor.name.as_deref()) {
                return None;
            }
            let reading = sensor.current_reading?;
            normalize_sensor_celsius(reading)
        }))
    }

    /// DIMM / memory sensors when firmware exposes them (often missing).
    fn sample_ram(com: COMLibrary, probes: &mut ProbeAvailability) -> Option<f32> {
        sample_ram_from_numeric_sensors(com, probes)
            .or_else(|| sample_ram_from_temperature_probe(com, probes))
    }

    fn sample_ram_from_numeric_sensors(
        com: COMLibrary,
        probes: &mut ProbeAvailability,
    ) -> Option<f32> {
        if probes.skip_numeric_sensor {
            return None;
        }

        let wmi = WMIConnection::new(com).ok()?;
        let sensors: Vec<NumericSensor> = match wmi.query() {
            Ok(s) => s,
            Err(err) => {
                probes.skip_numeric_sensor = true;
                log::debug!("CIM_NumericSensor unavailable ({err}); skipping further queries");
                return None;
            }
        };

        max_celsius(sensors.into_iter().filter_map(|sensor| {
            if sensor.sensor_type.is_some_and(|t| t != 2) {
                return None;
            }
            if !zone_name_suggests_ram(sensor.name.as_deref()) {
                return None;
            }
            let reading = sensor.current_reading?;
            normalize_sensor_celsius(reading)
        }))
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_TemperatureProbe")]
    #[serde(rename_all = "PascalCase")]
    struct TemperatureProbe {
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        current_reading: Option<i32>,
    }

    fn sample_ram_from_temperature_probe(
        com: COMLibrary,
        probes: &mut ProbeAvailability,
    ) -> Option<f32> {
        if probes.skip_temp_probe {
            return None;
        }

        let wmi = WMIConnection::new(com).ok()?;
        let rows: Vec<TemperatureProbe> = match wmi.query() {
            Ok(rows) => rows,
            Err(err) => {
                probes.skip_temp_probe = true;
                log::debug!("Win32_TemperatureProbe unavailable ({err}); skipping further queries");
                return None;
            }
        };
        max_celsius(rows.into_iter().filter_map(|probe| {
            let label = probe.name.as_deref().or(probe.description.as_deref());
            if !zone_name_suggests_ram(label) {
                return None;
            }
            let reading = probe.current_reading?;
            normalize_sensor_celsius(reading)
        }))
    }

    /// Heuristic: values in a normal °C range are treated as °C; larger as tenths-K.
    fn normalize_sensor_celsius(raw: i32) -> Option<f32> {
        let as_c = raw as f32;
        if (-40.0..=150.0).contains(&as_c) {
            return Some(as_c);
        }
        tenths_kelvin_to_celsius(raw)
    }
}
