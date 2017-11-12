/* eslint-disable */

const rollbar = jest.genMockFromModule('rollbar');

rollbar.handleError = jest.fn((err, req, cb) => {
    if (cb) {
        cb()
    }
});
rollbar.handleErrorWithPayloadData = jest.fn((err, payload, req, cb) => {
    if (cb) {
        cb()
    }
});
rollbar.reportMessage = jest.fn((message, level, req, cb) => {
    if (cb) {
        cb()
    }
});
rollbar.reportMessageWithPayloadData = jest.fn((message, payload, req, cb) => {
    if (cb) {
        cb()
    }
});

export default rollbar;
