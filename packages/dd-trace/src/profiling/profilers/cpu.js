'use strict'

class NativeCpuProfiler {
  constructor (options = {}) {
    this.type = 'wall'
    this._samplingInterval = options.samplingInterval || 10 * 1000
    this._mapper = undefined
    this._logger = undefined
    this._pprof = undefined
  }

  start ({ mapper, logger } = {}) {
    this._mapper = mapper
    this._logger = logger

    try {
      this._pprof = require('pprof')
    } catch (err) {
      if (this._logger) {
        this._logger.error(err)
      }
    }

    // pprof otherwise crashes in worker threads
    if (!process._startProfilerIdleNotifier) {
      process._startProfilerIdleNotifier = () => {}
    }
    if (!process._stopProfilerIdleNotifier) {
      process._stopProfilerIdleNotifier = () => {}
    }

    this._record()
  }

  profile () {
    if (!this._pprof) return
    const profile = this._stop()
    this._record()
    return profile
  }

  stop () {
    this._stop()
  }

  _record () {
    if (!this._pprof) return
    this._stop = this._pprof.time.start(this._samplingInterval, null,
      this._mapper)
  }
}

module.exports = NativeCpuProfiler