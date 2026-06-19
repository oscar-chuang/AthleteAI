module.exports = {
  copyAsync:          jest.fn(async () => {}),
  deleteAsync:        jest.fn(async () => {}),
  getContentUriAsync: jest.fn(async (uri) => `content://${uri}`),
  documentDirectory:  "file:///docs/",
  cacheDirectory:     "file:///cache/",
};
