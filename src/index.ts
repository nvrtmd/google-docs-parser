export const parseGoogleDoc = (docId: string) => {
  console.log(`Parsing document: ${docId}`);
  return { id: docId, title: "Test Document" };
};
