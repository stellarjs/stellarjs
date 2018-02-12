/**
 * Created by arolave on 29/05/2017.
 */
function transportMockFactory() {
  const transportMock = {
    request: jest.fn(),
    fireAndForget: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    subscribeGroup: jest.fn(),
    addRequestHandler: jest.fn(),
    generateId: jest.fn(),
  };

  let i = 1;
  transportMock.generateId.mockImplementation(() => `${i++}`);

  return transportMock;
}

export { transportMockFactory };
