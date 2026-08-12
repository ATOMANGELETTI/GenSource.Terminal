//! System metrics collector (CPU, RAM, network rates, Windows GPU via PDH).

use std::time::Instant;

use sysinfo::{Networks, System};

use crate::mdoels::SystemMetrics;

struct NetSnapshot {
    received: u64,
    transmitted: u64,
    at: Instant,
}

/// Reusable sampler kept in app state so consecutive reads share CPU/net history.
pub struct MetricsCollector {
    system: System,
    networks: Networks,
    last_net: Option<NetSnapshot>,
    #[cfg(windows)]
    gpu: Option<GpuPdh>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        let mut system = System::new();
        system.refresh_cpu_usage();
        system.refresh_memory();

        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);

        #[cfg(windows)]
        let gpu = GpuPdh::open();

        Self {
            system,
            networks,
            last_net: None,
            #[cfg(windows)]
            gpu,
        }
    }

    pub fn sample(&mut self) -> SystemMetrics {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.networks.refresh(true);

        let cpu_percent = self.system.global_cpu_usage().clamp(0.0, 100.0);
        let ram_used_bytes = self.system.used_memory();
        let ram_total_bytes = self.system.total_memory();

        let (net_up_bps, net_down_bps) = self.sample_network_rates();

        #[cfg(windows)]
        let gpu_percent = self
            .gpu
            .as_mut()
            .and_then(|g| g.sample_max_utilization());

        #[cfg(not(windows))]
        let gpu_percent: Option<f32> = None;

        SystemMetrics {
            cpu_percent,
            gpu_percent,
            ram_used_bytes,
            ram_total_bytes,
            net_up_bps,
            net_down_bps,
        }
    }

    fn sample_network_rates(&mut self) -> (f64, f64) {
        let mut received = 0u64;
        let mut transmitted = 0u64;
        for (_name, data) in self.networks.iter() {
            received = received.saturating_add(data.total_received());
            transmitted = transmitted.saturating_add(data.total_transmitted());
        }
        let now = Instant::now();

        let rates = if let Some(prev) = &self.last_net {
            let elapsed = now.duration_since(prev.at).as_secs_f64();
            if elapsed > 0.0 {
                let down = received.saturating_sub(prev.received) as f64 / elapsed;
                let up = transmitted.saturating_sub(prev.transmitted) as f64 / elapsed;
                (up, down)
            } else {
                (0.0, 0.0)
            }
        } else {
            (0.0, 0.0)
        };

        self.last_net = Some(NetSnapshot {
            received,
            transmitted,
            at: now,
        });
        rates
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(windows)]
mod gpu_pdh {
    use std::alloc::{alloc_zeroed, dealloc, Layout};

    use windows::core::w;
    use windows::Win32::System::Performance::{
        PdhAddEnglishCounterW, PdhCloseQuery, PdhCollectQueryData, PdhGetFormattedCounterArrayW,
        PdhOpenQueryW, PDH_FMT_COUNTERVALUE_ITEM_W, PDH_FMT_DOUBLE, PDH_HCOUNTER, PDH_HQUERY,
    };

    /// PDH status when the caller must allocate a larger buffer.
    const PDH_MORE_DATA: u32 = 0x8000_07D2;
    /// PDH_CSTATUS_VALID_DATA / PDH_CSTATUS_NEW_DATA
    const PDH_STATUS_OK: [u32; 2] = [0, 1];

    pub struct GpuPdh {
        query: PDH_HQUERY,
        counter: PDH_HCOUNTER,
        primed: bool,
    }

    // PDH handles are raw pointers; exclusive access is via the outer Mutex.
    unsafe impl Send for GpuPdh {}

    impl GpuPdh {
        pub fn open() -> Option<Self> {
            unsafe {
                let mut query = PDH_HQUERY::default();
                let status = PdhOpenQueryW(None, 0, &mut query);
                if status != 0 {
                    log::debug!("PdhOpenQueryW failed: 0x{status:X}");
                    return None;
                }

                let mut counter = PDH_HCOUNTER::default();
                let status = PdhAddEnglishCounterW(
                    query,
                    w!("\\GPU Engine(*)\\Utilization Percentage"),
                    0,
                    &mut counter,
                );
                if status != 0 {
                    log::debug!("PdhAddEnglishCounterW (GPU Engine) failed: 0x{status:X}");
                    let _ = PdhCloseQuery(query);
                    return None;
                }

                // First collect primes the counter; values appear on the next sample.
                let status = PdhCollectQueryData(query);
                if status != 0 {
                    log::debug!("PdhCollectQueryData (prime) failed: 0x{status:X}");
                    let _ = PdhCloseQuery(query);
                    return None;
                }

                Some(Self {
                    query,
                    counter,
                    primed: true,
                })
            }
        }

        /// Max utilization across GPU engines, or `None` if sampling fails.
        pub fn sample_max_utilization(&mut self) -> Option<f32> {
            if !self.primed {
                return None;
            }

            unsafe {
                let status = PdhCollectQueryData(self.query);
                if status != 0 {
                    log::debug!("PdhCollectQueryData failed: 0x{status:X}");
                    return None;
                }

                self.read_max_utilization().or_else(|| {
                    // Instance list may grow between size probe and fill.
                    self.read_max_utilization()
                })
            }
        }

        unsafe fn read_max_utilization(&self) -> Option<f32> {
            let mut buffer_size = 0u32;
            let mut item_count = 0u32;
            let status = unsafe {
                PdhGetFormattedCounterArrayW(
                    self.counter,
                    PDH_FMT_DOUBLE,
                    &mut buffer_size,
                    &mut item_count,
                    None,
                )
            };
            if status != 0 && status != PDH_MORE_DATA {
                log::debug!("PdhGetFormattedCounterArrayW (size) failed: 0x{status:X}");
                return None;
            }
            if buffer_size == 0 {
                return None;
            }

            let align = std::mem::align_of::<PDH_FMT_COUNTERVALUE_ITEM_W>();
            let layout = Layout::from_size_align(buffer_size as usize, align).ok()?;
            let ptr = unsafe { alloc_zeroed(layout) };
            if ptr.is_null() {
                return None;
            }

            let status = unsafe {
                PdhGetFormattedCounterArrayW(
                    self.counter,
                    PDH_FMT_DOUBLE,
                    &mut buffer_size,
                    &mut item_count,
                    Some(ptr.cast::<PDH_FMT_COUNTERVALUE_ITEM_W>()),
                )
            };

            let result = if status == PDH_MORE_DATA {
                None
            } else if status != 0 {
                log::debug!("PdhGetFormattedCounterArrayW failed: 0x{status:X}");
                None
            } else {
                let items = unsafe {
                    std::slice::from_raw_parts(
                        ptr.cast::<PDH_FMT_COUNTERVALUE_ITEM_W>(),
                        item_count as usize,
                    )
                };

                let mut max = 0.0f64;
                let mut any = false;
                for item in items {
                    if PDH_STATUS_OK.contains(&item.FmtValue.CStatus) {
                        let v = unsafe { item.FmtValue.Anonymous.doubleValue };
                        if v.is_finite() {
                            any = true;
                            if v > max {
                                max = v;
                            }
                        }
                    }
                }

                if any {
                    Some(max.clamp(0.0, 100.0) as f32)
                } else {
                    None
                }
            };

            unsafe {
                dealloc(ptr, layout);
            }
            result
        }
    }

    impl Drop for GpuPdh {
        fn drop(&mut self) {
            unsafe {
                let _ = PdhCloseQuery(self.query);
            }
        }
    }
}

#[cfg(windows)]
use gpu_pdh::GpuPdh;
