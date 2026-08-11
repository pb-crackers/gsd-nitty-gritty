#!/usr/bin/env node

/**
 * Regression suite entry point.
 *
 *   node test/run.cjs           run everything
 *   node test/run.cjs roadmap   run tests whose name contains "roadmap"
 */

require('./roadmap.test.cjs');
require('./state.test.cjs');
require('./comment-preservation.test.cjs');
require('./requirements.test.cjs');

require('./harness.cjs').runAll();
