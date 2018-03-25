export default function standardizeObjectFactory({ standardizeDates }) {
  if (!standardizeDates) {
    return function (x) {
      return x;
    };
  }

  return function standardizeObject(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  };
}
