const {
  TEST_TYPE,
  TEST_NAME,
  TEST_SUITE,
  TEST_STATUS,
  getTestEnvironmentMetadata,
  CI_APP_ORIGIN
} = require('../../dd-trace/src/plugins/util/test')

const id = require('../../dd-trace/src/id')
const { SAMPLING_RULE_DECISION, ORIGIN_KEY } = require('../../dd-trace/src/constants')
const { SAMPLING_PRIORITY, SPAN_TYPE, RESOURCE_NAME } = require('../../../ext/tags')
const { AUTO_KEEP } = require('../../../ext/priority')

const CYPRESS_STATUS_TO_TEST_STATUS = {
  passed: 'pass',
  failed: 'fail',
  pending: 'skip',
  skipped: 'skip'
}

function getTestSpanMetadata (tracer, testName, testSuite) {
  const childOf = tracer.extract('text_map', {
    'x-datadog-trace-id': id().toString(10),
    'x-datadog-parent-id': '0000000000000000',
    'x-datadog-sampled': 1
  })

  return {
    childOf,
    resource: `${testSuite}.${testName}`,
    [TEST_TYPE]: 'test',
    [TEST_NAME]: testName,
    [TEST_SUITE]: testSuite,
    [SAMPLING_RULE_DECISION]: 1,
    [SAMPLING_PRIORITY]: AUTO_KEEP
  }
}

module.exports = (on, config) => {
  const tracer = require('../../dd-trace')
  const testEnvironmentMetadata = getTestEnvironmentMetadata('cypress')
  let activeSpan = null
  on('after:run', () => {
    return new Promise(resolve => {
      tracer._tracer._exporter._writer.flush(() => resolve(null))
    })
  })
  on('task', {
    beforeEach: (test) => {
      const { testName, testSuite } = test

      const {
        childOf,
        resource,
        ...testSpanMetadata
      } = getTestSpanMetadata(tracer, testName, testSuite)

      if (!activeSpan) {
        activeSpan = tracer.startSpan('cypress.test', {
          childOf,
          tags: {
            [SPAN_TYPE]: 'test',
            [RESOURCE_NAME]: resource,
            [ORIGIN_KEY]: CI_APP_ORIGIN,
            ...testSpanMetadata,
            ...testEnvironmentMetadata
          }
        })
      }
      return null
    },
    afterEach: (test) => {
      const { state, error } = test
      if (activeSpan) {
        activeSpan.setTag(TEST_STATUS, CYPRESS_STATUS_TO_TEST_STATUS[state])
        if (error) {
          activeSpan.setTag('error.msg', error.message)
          activeSpan.setTag('error.type', error.name)
          activeSpan.setTag('error.stack', error.stack)
        }
        activeSpan.finish()
      }
      activeSpan = null
      return null
    }
  })
}
