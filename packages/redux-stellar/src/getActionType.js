import isFunction from 'lodash/isFunction';
import times from 'lodash/times';

const FULFILLED = 'FULFILLED';
const PENDING = 'PENDING';
const REJECTED = 'REJECTED';
const UNSUBSCRIBE = 'UNSUBSCRIBE';

const DOCUMENT_ADDED = 'DOCUMENT_ADDED';
const DOCUMENT_UPDATED = 'DOCUMENT_UPDATED';
const DOCUMENT_REMOVED = 'DOCUMENT_REMOVED';

const fakeArgsArray = times(10, () => (action => action));

function getActionProps(action) {
  return action(...fakeArgsArray);
}

export function getActionType(action) {
  const theAction = isFunction(action) ? getActionProps(action) : action;
  if (theAction.type) {
    return theAction.type;
  }

  const pathSuffix = theAction.path ? `:${theAction.path}` : '';
  return `${theAction.resource}:${theAction.method}${pathSuffix}`;
}

export function getPendingActionType(action) {
  return `${getActionType(action)}_${PENDING}`;
}

export function getFulfilledActionType(action) {
  return `${getActionType(action)}_${FULFILLED}`;
}

export function getRejectedActionType(action) {
  return `${getActionType(action)}_${REJECTED}`;
}

export function getUnsubscribeActionType(action) {
  return `${getActionType(action)}_${UNSUBSCRIBE}`;
}

export function getDocAddedActionType(action) {
  return `${getActionType(action)}_${DOCUMENT_ADDED}`;
}

export function getDocUpdatedActionType(action) {
  return `${getActionType(action)}_${DOCUMENT_UPDATED}`;
}

export function getDocRemovedActionType(action) {
  return `${getActionType(action)}_${DOCUMENT_REMOVED}`;
}
