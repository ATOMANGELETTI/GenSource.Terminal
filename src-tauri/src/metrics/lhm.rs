//! LibreHardwareMonitor-backed temperatures (Windows, via `lhm-sys`).
//!
//! Speccy-class CPU / GPU / DIMM sensors. First-use driver install may need
//! elevation; failures leave all fields `None` so WMI/NVML can fall back.

#![cfg(windows)]

use std::sync::atomic::{AtomicBool, Ordering};

use lhm_sys::{Computer, ComputerOptions};

use super::thermal::ThermalTemps;

/// LibreHardwareMonitor hardware type ids (matches LHM / `lhm-shared`).
const HW_MOTHERBOARD: i32 = 0;
const HW_SUPER_IO: i32 = 1;
const HW_CPU: i32 = 2;
const HW_MEMORY: i32 = 3;
const HW_GPU_NVIDIA: i32 = 4;
const HW_GPU_AMD: i32 = 5;
const HW_GPU_INTEL: i32 = 6;

/// LibreHardwareMonitor `SensorType::Temperature`.
const SENSOR_TEMPERATURE: i32 = 4;

static LOGGED_CREATE_FAIL: AtomicBool = AtomicBool::new(false);
static LOGGED_READY: AtomicBool = AtomicBool::new(false);

/// Cached LHM computer instance (expensive to create; update each sample).
pub struct LhmSampler {
    computer: Option<Computer>,
}

impl LhmSampler {
    pub fn open() -> Self {
        match Computer::create() {
            Ok(mut computer) => {
                computer.set_options(ComputerOptions {
                    battery_enabled: false,
                    controller_enabled: true,
                    cpu_enabled: true,
                    gpu_enabled: true,
                    memory_enabled: true,
                    motherboard_enabled: true,
                    network_enabled: false,
                    psu_enabled: false,
                    storage_enabled: false,
                });
                computer.update();
                if !LOGGED_READY.swap(true, Ordering::Relaxed) {
                    log::info!("LibreHardwareMonitor computer ready");
                }
                Self {
                    computer: Some(computer),
                }
            }
            Err(err) => {
                if !LOGGED_CREATE_FAIL.swap(true, Ordering::Relaxed) {
                    log::warn!(
                        "LibreHardwareMonitor unavailable ({err}); CPU/GPU/RAM temps fall back to WMI/NVML"
                    );
                }
                Self { computer: None }
            }
        }
    }

    pub fn sample(&mut self) -> ThermalTemps {
        let Some(computer) = self.computer.as_mut() else {
            return ThermalTemps::default();
        };

        computer.update();

        let mut cpu_temps: Vec<(String, f32)> = Vec::new();
        let mut gpu_temps: Vec<f32> = Vec::new();
        let mut ram_temps: Vec<f32> = Vec::new();

        for hw in computer.hardware() {
            collect_temps(&hw, &mut cpu_temps, &mut gpu_temps, &mut ram_temps);
            for child in hw.get_children() {
                collect_temps(&child, &mut cpu_temps, &mut gpu_temps, &mut ram_temps);
                for grand in child.get_children() {
                    collect_temps(&grand, &mut cpu_temps, &mut gpu_temps, &mut ram_temps);
                }
            }
        }

        ThermalTemps {
            cpu_temp_celsius: pick_cpu_temp(&cpu_temps),
            gpu_temp_celsius: max_plausible(gpu_temps),
            ram_temp_celsius: max_plausible(ram_temps),
        }
    }
}

fn collect_temps(
    hw: &lhm_sys::Hardware,
    cpu_temps: &mut Vec<(String, f32)>,
    gpu_temps: &mut Vec<f32>,
    ram_temps: &mut Vec<f32>,
) {
    let hw_ty = hw.get_type();
    let hw_name = hw.name();

    for sensor in hw.sensors() {
        if sensor.get_type() != SENSOR_TEMPERATURE {
            continue;
        }
        let value = sensor.value();
        if !is_plausible_celsius(value) {
            continue;
        }
        let name = sensor.name();

        match hw_ty {
            HW_CPU => cpu_temps.push((name, value)),
            HW_GPU_NVIDIA | HW_GPU_AMD | HW_GPU_INTEL => gpu_temps.push(value),
            HW_MEMORY => {
                if name_suggests_ram(&name) || name_suggests_ram(&hw_name) {
                    ram_temps.push(value);
                } else if !name_suggests_gpu(&name) {
                    // Memory hardware temps are usually DIMM/module readings.
                    ram_temps.push(value);
                }
            }
            HW_MOTHERBOARD | HW_SUPER_IO => {
                if name_suggests_ram(&name) {
                    ram_temps.push(value);
                } else if name_suggests_cpu_sensor(&name) {
                    // Some boards expose package-like readings under SuperIO.
                    cpu_temps.push((name, value));
                }
            }
            _ => {
                if name_suggests_ram(&name) {
                    ram_temps.push(value);
                } else if name_suggests_cpu_sensor(&name) {
                    cpu_temps.push((name, value));
                } else if name_suggests_gpu(&name) {
                    gpu_temps.push(value);
                }
            }
        }
    }
}

fn pick_cpu_temp(temps: &[(String, f32)]) -> Option<f32> {
    if temps.is_empty() {
        return None;
    }

    const PREFERRED: &[&str] = &[
        "CPU Package",
        "CPU (Tctl/Tdie)",
        "Tctl/Tdie",
        "Core Average",
        "Core Max",
        "CPU Core",
    ];

    for preferred in PREFERRED {
        if let Some((_, v)) = temps.iter().find(|(n, _)| n.eq_ignore_ascii_case(preferred)) {
            return Some(*v);
        }
    }

    // Prefer any sensor whose name looks like a package reading.
    if let Some((_, v)) = temps.iter().find(|(n, _)| {
        let u = n.to_ascii_uppercase();
        u.contains("PACKAGE") || u.contains("TCTL") || u.contains("TDIE")
    }) {
        return Some(*v);
    }

    max_plausible(temps.iter().map(|(_, v)| *v))
}

fn max_plausible(values: impl IntoIterator<Item = f32>) -> Option<f32> {
    values
        .into_iter()
        .filter(|v| is_plausible_celsius(*v))
        .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
}

fn is_plausible_celsius(v: f32) -> bool {
    v.is_finite() && (-40.0..=150.0).contains(&v)
}

fn name_suggests_ram(name: &str) -> bool {
    let u = name.to_ascii_uppercase();
    u.contains("DIMM")
        || u.contains("DRAM")
        || u.contains("SODIMM")
        || (u.contains("MEMORY") && u.contains("TEMP"))
        || (u.contains("RAM") && !u.contains("PROGRAM"))
}

fn name_suggests_gpu(name: &str) -> bool {
    let u = name.to_ascii_uppercase();
    u.contains("GPU") || u.contains("GFX") || u.contains("VIDEO")
}

fn name_suggests_cpu_sensor(name: &str) -> bool {
    let u = name.to_ascii_uppercase();
    u.contains("CPU PACKAGE")
        || u.contains("TCTL")
        || u.contains("TDIE")
        || u.contains("CORE MAX")
        || u.contains("CORE AVERAGE")
        || (u.contains("CPU") && u.contains("TEMP"))
}
