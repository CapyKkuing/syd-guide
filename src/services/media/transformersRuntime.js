export async function createImageClassifier() {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.remoteHost = `${window.location.origin}/api/ai-models/`;
  const model = await pipeline(
    "image-classification",
    "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
    {
      device: "wasm",
      dtype: "q8",
      revision: "3ba07f12712fa58fd6b3d661f9909c9e332c5005",
    }
  );
  return (image, options) => model(image, options);
}
