import os from 'os';
import EventEmitter from 'events';

class ResourceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    // CPU load threshold (per CPU core average), e.g., 0.8 means 80% load
    this.cpuThreshold = options.cpuThreshold || 0.8;
    // RAM usage threshold as a fraction, e.g., 0.8 means 80% used
    this.ramThreshold = options.ramThreshold || 0.8;
    // Monitoring interval in milliseconds (default: 60 seconds)
    this.checkInterval = options.checkInterval || 60 * 1000;
    this.monitorInterval = null;
  }

  startMonitoring() {
    if (this.monitorInterval) return;
    this.monitorInterval = setInterval(() => {
      const cpuCount = os.cpus().length;
      const loadAvg = os.loadavg()[0] / cpuCount; // 1-minute average per core
      const freeMemRatio = os.freemem() / os.totalmem();
      
      // Determine if system is under heavy load
      const isCpuOverloaded = loadAvg > this.cpuThreshold;
      const isRamOverloaded = (1 - freeMemRatio) > this.ramThreshold;
      
      const status = {
        loadAvg,
        freeMemRatio,
        cpuOverloaded: isCpuOverloaded,
        ramOverloaded: isRamOverloaded
      };

      if (isCpuOverloaded || isRamOverloaded) {
        this.emit('overload', status);
        console.log('[ResourceManager] Overload detected:', status);
      } else {
        this.emit('normal', status);
        console.log('[ResourceManager] System resources normal:', status);
      }
    }, this.checkInterval);

    console.log('[ResourceManager] Started resource monitoring.');
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('[ResourceManager] Stopped resource monitoring.');
    }
  }
}

export default new ResourceManager();
