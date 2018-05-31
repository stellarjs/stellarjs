import get from 'lodash/get';

import sessions from './sessions';

export default function getSessionFactory() {
  return function getSession(path) {
    return get(sessions, path);
  };
}
