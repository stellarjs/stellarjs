import { getActionType } from '../src/getActionType';

describe('getActionType', () => {
  it('should return action type - 3 parameters', () => {
    function testFn(payload, options, dispatch = () => null) {
        return dispatch({
            resource: 'resource',
            method: 'get',
            path: 'path',
            payload,
            options,
          });
      }
    const actionPath = getActionType(testFn);
    expect(actionPath).toEqual('resource:path:get');
  });
  it('should return action type, no path - 4 parameters', () => {
    function testFn({ id }, { bla }, options, dispatch = () => null) {
        return dispatch({
            resource: 'resource',
            method: 'get',
            payload: { id, bla },
            options,
          });
      }
    const actionPath = getActionType(testFn);
    expect(actionPath).toEqual('resource:get');
  });
  it('should return action type - 4 parameters', () => {
      function testFn({ id }, { bla }, options, dispatch = () => null) {
          return dispatch({
              resource: 'resource',
              method: 'get',
              path: 'path',
              payload: { id, bla },
              options,
            });
        }
      const actionPath = getActionType(testFn);

      expect(actionPath).toEqual('resource:path:get');
    });
  it('should return action type by action type', () => {
      function testFn(payload, options, dispatch = () => null) {
          return dispatch({
              type: 'ACTION_TYPE',
              resource: 'resource',
              method: 'get',
              path: 'path',
              payload,
              options,
            });
        }
      const actionPath = getActionType(testFn);
      expect(actionPath).toEqual('ACTION_TYPE');
    });
    it('should return action type when getting object', () => {
        function testFn(payload, options) {
            return {
                resource: 'resource',
                method: 'get',
                path: 'path',
                payload,
                options,
            };
        }
        const actionPath = getActionType(testFn);
        expect(actionPath).toEqual('resource:path:get');
    });
});
