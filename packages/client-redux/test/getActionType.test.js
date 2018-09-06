import {
  getActionType,
  getPendingActionType,
  getFulfilledActionType,
  getDocAddedActionType,
  getDocRemovedActionType,
  getDocUpdatedActionType,
  getRejectedActionType,
  getUnsubscribeActionType,
} from '../src/getActionType';

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

  describe('derived action types', () => {
    function testFn({ id }, { bla }, options, dispatch = () => null) {
      return dispatch({
        resource: 'resource',
        method: 'get',
        payload: { id, bla },
        options,
      });
    }

    it('should return a pending action', () => {
      expect(getPendingActionType(testFn)).toEqual('resource:get_PENDING');
    });

    it('should return a fullfilled action', () => {
      expect(getFulfilledActionType(testFn)).toEqual('resource:get_FULFILLED');
    });

    it('should return a unsubscribe action', () => {
      expect(getUnsubscribeActionType(testFn)).toEqual('resource:get_UNSUBSCRIBE');
    });

    it('should return a DocAdded action', () => {
      expect(getDocAddedActionType(testFn)).toEqual('resource:get_DOCUMENT_ADDED');
    });

    it('should return a DocUpdated action', () => {
      expect(getDocUpdatedActionType(testFn)).toEqual('resource:get_DOCUMENT_UPDATED');
    });

    it('should return a DocRemoved action', () => {
      expect(getDocRemovedActionType(testFn)).toEqual('resource:get_DOCUMENT_REMOVED');
    });

    it('should return a Rejected action', () => {
      expect(getRejectedActionType(testFn)).toEqual('resource:get_REJECTED');
    });
  });
});
