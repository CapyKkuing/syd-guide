export async function createImageClassifier() {
  const { pipeline } = await import("@huggingface/transformers");
  const model = await pipeline(
    "image-classification",
    "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
    { dtype: "q8", revision: "main" }
  );
  return (image, options) => model(image, options);
}
