const Env = use("Env");
const streamBuffers = require("stream-buffers");
const Logger = use("Logger");
const moment = require("moment");
const _ = require("lodash");
const shortId = require("shortid");
const serializeError = require("serialize-error");

const Azure = require("azure-storage");
const RetryOperations = new Azure.ExponentialRetryPolicyFilter();
const blobSvc = Azure.createBlobService(Env.get("AZURE_CONNECTION_STRING")).withFilter(RetryOperations);

class StorageKeeper {
	async saveBlob(filename, bufferFile) {
		return new Promise(async (resolve) => {
			try {
				const containerStatus = await this.containerCheck();
				if (containerStatus) {
					// make readable stream
					let readableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
						frequency: 10, // in milliseconds.
						chunkSize: 2048, // in bytes.
					});
					readableStreamBuffer.put(bufferFile);
					readableStreamBuffer.stop();
					blobSvc.createBlockBlobFromStream(
						Env.get("AZURE_STORAGE_CONTAINER"),
						filename,
						readableStreamBuffer,
						bufferFile.length,
						function(error, result, response) {
							if (!error) {
								resolve({
									status: "OK",
									data: blobSvc.getUrl(Env.get("AZURE_STORAGE_CONTAINER"), filename),
								});
							} else {
								// Add _1 on filename and retry
								Logger.warning("StorageKeeper:saveBlob:shallRetry:" + filename, error);
								filename += "_1";
								this.saveBlob(filename, bufferFile);
							}
						},
					);
				} else {
					Logger.warning("StorageKeeper:saveBlob", containerStatus.error);
					resolve({
						status: "FAIL",
						error: containerStatus.error,
					});
				}
			} catch (e) {
				Logger.warning("StorageKeeper:saveBlob", serializeError(e));
				resolve({
					status: "FAIL",
					error: e,
				});
			}
		});
	}

	async deleteBlob(filename) {
		try {
			blobSvc.deleteBlob(Env.get("AZURE_STORAGE_CONTAINER"), filename, function(error, response) {
				if (!error) {
					resolve(true);
				} else {
					Logger.warning("StorageKeeper:deleteBlob", error);
					return {
						status: "FAIL",
						error: error,
					};
				}
			});
		} catch (error) {
			Logger.warning("StorageKeeper:deleteBlob", serializeError(error));
			return {
				status: "FAIL",
				error: error,
			};
		}
	}

	async generateUploadURL(extension) {
		try {
			return new Promise(async (resolve) => {
				const filename = `${this.generateFilename()}.${extension}`;

				const startDate = new Date();
				const expiryDate = new Date(startDate);
				expiryDate.setMinutes(startDate.getMinutes() + 100);
				startDate.setMinutes(startDate.getMinutes() - 100);

				const sharedAccessPolicy = {
					AccessPolicy: {
						Permissions: "acwl",
						Start: startDate,
						Expiry: expiryDate,
					},
				};
				// generate token
				const sasToken = blobSvc.generateSharedAccessSignature(
					Env.get("AZURE_STORAGE_CONTAINER"),
					filename,
					sharedAccessPolicy,
				);
				// generate upload URL
				const url = blobSvc.getUrl(Env.get("AZURE_STORAGE_CONTAINER"), filename, sasToken);
				resolve({ filename: filename, url: url, expiry_date: expiryDate });
			});
		} catch (error) {
			Logger.warning("StorageKeeper:generateUploadURL", serializeError(e));
			return {
				status: "FAIL",
				error: error,
			};
		}
	}

	async containerCheck() {
		return new Promise((resolve) => {
			try {
				blobSvc.createContainerIfNotExists(
					Env.get("AZURE_STORAGE_CONTAINER"),
					{
						publicAccessLevel: "blob",
					},
					function(error, result, response) {
						if (!error) {
							resolve(true);
							// If result= true, container was created. If result = false, container already existed.
						} else {
							Logger.warning("StorageKeeper:containerCheck", error);
							resolve(false);
						}
					},
				);
			} catch (e) {
				Logger.warning("StorageKeeper:containerCheck", serializeError(e));
				resolve(false);
			}
		});
	}

	// generate filename
	generateFilename() {
		let x = moment().diff(moment("2017-07-01"), "hours").toString(16);
		// ~ last 6 string is random char
		let y = shortId.generate().replace(/[-_]/gi, "0").slice(0, 6);
		let trxid = (x + y).toUpperCase();
		trxid = "DOV" + _.padStart(trxid, 13, "X");
		return trxid;
	}
}

module.exports = new StorageKeeper();
