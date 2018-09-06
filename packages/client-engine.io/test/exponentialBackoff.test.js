import Promise from 'bluebird';
import configureExponentialBackoff from '../src/exponentialBackoff';


describe('exponential backoff', () => {
  it('should call toTry fn if called and max=1', () => {
    const exponentialBackoff = configureExponentialBackoff(1000, console);
    const mock = jest.fn(() => Promise.resolve(1));
    exponentialBackoff(mock, 1, 200);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('should not call toTry fn if called and max=0', () => {
    const exponentialBackoff = configureExponentialBackoff(1000, console);
    const mock = jest.fn(() => Promise.resolve(1));
    exponentialBackoff(mock, 0, 200);
    expect(mock).not.toHaveBeenCalledTimes(2);
  });

  it('should call toTry once only if called and max=1', async () => {
    const exponentialBackoff = configureExponentialBackoff(1000, console);
    const mock = jest.fn(() => Promise.reject(new Error('fail')));
    exponentialBackoff(mock, 1, 200);
    expect(mock).toHaveBeenCalledTimes(1);
    await Promise.delay(250);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  // function expectEventually(expectation, )

  it('backoff should be exponential if trying multiple times', async () => {
    const exponentialBackoff = configureExponentialBackoff(1000, console);
    const mock = jest.fn(() => Promise.reject(new Error('fail')));
    exponentialBackoff(mock, 4, 200);
    expect(mock).toHaveBeenCalledTimes(1);
    await Promise.delay(250);
    expect(mock).toHaveBeenCalledTimes(2);
    await Promise.delay(300);
    expect(mock).toHaveBeenCalledTimes(3);
    await Promise.delay(350);
    expect(mock).toHaveBeenCalledTimes(4);
    await Promise.delay(500);
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it('backoff should be exponential up until the maxDelay', async () => {
    const exponentialBackoff = configureExponentialBackoff(200, console);
    const mock = jest.fn(() => Promise.reject(new Error('fail')));
    exponentialBackoff(mock, 4, 199);
    expect(mock).toHaveBeenCalledTimes(1);
    await Promise.delay(250);
    expect(mock).toHaveBeenCalledTimes(2);
    await Promise.delay(250);
    expect(mock).toHaveBeenCalledTimes(3);
    await Promise.delay(250);
    expect(mock).toHaveBeenCalledTimes(4);
    await Promise.delay(250);
    expect(mock).toHaveBeenCalledTimes(4);
  });
});