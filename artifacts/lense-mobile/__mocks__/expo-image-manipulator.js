module.exports = {
  manipulateAsync: jest.fn(async (uri) => ({ uri, width: 320, height: 320 })),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
  FlipType: { Vertical: "vertical", Horizontal: "horizontal" },
};
