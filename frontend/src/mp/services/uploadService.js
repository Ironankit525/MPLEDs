/**
 * File & Media Upload Abstraction Adapter.
 */
export const uploadService = {
  uploadFile: async (file) => {
    // Simulated upload delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      url: `https://storage.demo.mplads.gov.in/${file.name}`,
      filename: file.name,
      uploadedAt: new Date().toISOString()
    };
  }
};
