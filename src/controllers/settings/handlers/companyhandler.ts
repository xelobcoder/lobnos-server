import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import logger from "../../../hooks/logger";
import { insertCompanyProfile, truncateCompanyProfile, getAllCompanyProfiles } from "../../../models/settings/companyProfile";
import { OperationsFailures } from "../../../models/operations/types";
import { uploadImageFile } from "./imageUpload";
import { customError, responseError } from "../../../hooks/helper";
import { companyImageDirectory, companyImageMime, companyImageTenantId, readCompanyImage } from "../../../models/settings/companyImageStorage";

export const AddCompanyInfoHandler = async (request: Request<{},{},{name:string,motto:string,email:string,phonenumber:string|number},{tenantId:string|number}>, response: Response) => {
	try {
		const { name, motto, email, phonenumber } = request.body;
		const tenantId = parseInt(request.query.tenantId.toString());
		const hasNecessaryRequestBodyParams = name && typeof motto === "string" && email && phonenumber;
		if (!hasNecessaryRequestBodyParams) return customError(OperationsFailures.invalidRequestBodyType + ". Necessary request body params not included", 400, response);
		await insertCompanyProfile(tenantId, request.body as any);
		return response.send({ status: "success" });
	} catch (err:any) {
		console.log(err)
		return responseError(response);
	}
};

export const getCompanyInfoHandler = async (request: Request<{}, {}, {}, {tenantId:string|number}>, response: Response): Promise<void> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		let result = await getAllCompanyProfiles(tenantId);
		response.send(result);
	} catch (err:any) {
		responseError(response);
	}
};

export const getCompanyImageHandler = async (request: Request, response: Response): Promise<void> => {
	const tenantId = companyImageTenantId(request.query.tenantId);
	if (tenantId === null) {
		customError("A valid tenantId is required", 400, response);
		return;
	}
	response.setHeader("Cache-Control", "no-store");
	try {
		const result = readCompanyImage(tenantId);
		if (result) {
			const { image, contentType } = result;
			response.setHeader("Content-Type", contentType);
			response.setHeader("X-Content-Type-Options", "nosniff");
			response.setHeader("Content-Length", image.length.toString());
			response.send(image);
		} else {
			response.status(404).send("Image not found");
		}
	} catch (error) {
		logger.error("Unable to read company image");
		response.status(500).send("Internal Server Error");
	}
};



export const handleUploadCompanyImage = async (request: Request, response: Response): Promise<void> => {
	const tenantId = companyImageTenantId(request.query.tenantId);
	if (tenantId === null) {
		customError("A valid tenantId is required", 400, response);
		return;
	}
	const destinationDir = companyImageDirectory(tenantId);
	const field = "file";
	try {
		fs.mkdirSync(destinationDir, { recursive: true });
		const uploadResult = await uploadImageFile(request, response, destinationDir, field);

		if (uploadResult && request.file && companyImageMime(fs.readFileSync(request.file.path))) {
			// Replace only after a successful upload; readers see the old or new complete image.
			fs.renameSync(request.file.path, path.join(destinationDir, 'logo'));
			response.status(200).json({
				status: "success",
				message: "Company image uploaded successfully",
			});
		} else {
			if (request.file?.path && fs.existsSync(request.file.path)) fs.unlinkSync(request.file.path);
			response.status(400).json({
				status: "error",
				message: "No image uploaded or invalid file type",
			});
		}
	} catch (error) {
		if (request.file?.path && fs.existsSync(request.file.path)) fs.unlinkSync(request.file.path);
		response.status(500).json({
			status: "error",
			message: "Failed to upload image",
		});
	}
};
