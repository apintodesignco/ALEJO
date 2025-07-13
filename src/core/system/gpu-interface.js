const { execSync } = require('child_process');

class GPUInterface {
  constructor() {
    this.gpuVendor = this.detectVendor();
  }
  
  detectVendor() {
    try {
      // Check for NVIDIA
      execSync('nvidia-smi --version');
      return 'nvidia';
    } catch {
      try {
        // Check for AMD
        execSync('rocm-smi --version');
        return 'amd';
      } catch {
        return 'unknown';
      }
    }
  }
  
  getUsage() {
    if (this.gpuVendor === 'nvidia') {
      const output = execSync('nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits').toString();
      const [utilization, usedMem, totalMem] = output.split(',').map(Number);
      return {
        utilization,
        memory: {
          used: usedMem,
          total: totalMem,
          free: totalMem - usedMem
        }
      };
    } else if (this.gpuVendor === 'amd') {
      const output = execSync('rocm-smi --showuse --showmem').toString();
      // Parse output (simplified example)
      const utilization = parseFloat(output.match(/GPU use\(%\)\s*:\s*(\d+\.\d+)/)[1]);
      const usedMem = parseFloat(output.match(/VRAM total\(MiB\)\s*:\s*(\d+\.\d+)/)[1]);
      const totalMem = parseFloat(output.match(/VRAM total\(MiB\)\s*:\s*(\d+\.\d+)/)[1]);
      return {
        utilization,
        memory: {
          used: usedMem,
          total: totalMem,
          free: totalMem - usedMem
        }
      };
    } else {
      throw new Error('Unsupported GPU vendor');
    }
  }
  
  setMemoryThreshold(threshold) {
    this.memoryThreshold = threshold;
  }
  
  checkMemoryThreshold() {
    const usage = this.getUsage();
    return usage.memory.used / usage.memory.total > this.memoryThreshold;
  }
}

module.exports = GPUInterface;
