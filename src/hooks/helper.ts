import { primeTenancyConnector } from '../models/Tenancy/tenantConnections';
import { databaseConnectionPool } from './../database/connection'
import { configuration } from './configuration';
import logger from './logger';


function customError(message: string, statusCode: number, response: any) {
	if (!response) throw new TypeError("Http response object required");
	response.status(statusCode || 500).send({
		message: message || "something wrong occurred",
		statusCode: statusCode || 500,
		status: "error",
	});
}

function DuplicateError(response: any) {
	return customError(`Duplicate, item already exists`, 409, response);
}

function responseError(response: any, err: any = null, statusCode?: 500) {
	const errorMessage = err
		? (typeof err === "string" ? err : (err.message || err.toString() || "something wrong occurred"))
		: "something wrong occurred";

	response.status(statusCode || 500).send({
		message: errorMessage,
		statusCode: 500,
		status: "error",
	});

	if (err) logger.error(err);
}

const removeHtmlTags = (string: string): string => {
	const removeTags = (
		string: string,
		starter: string,
		ended: string
	): string => {
		const _stringArray = string.trim().split("");
		let start = 0;
		let end = 0;

		for (let i = 0; i < _stringArray.length; i++) {
			if (_stringArray[i] === starter) start = i;
			if (_stringArray[i] === ended) {
				end = i;
				break;
			}
		}

		const unmatched = _stringArray.map((item, index) =>
			!(index >= start && index <= end) ? item : undefined
		);

		const result = unmatched.join("");

		if (unmatched.includes(starter) || unmatched.includes(ended)) {
			return removeTags(result, starter, ended);
		}
		return result.toLowerCase();
	};
	return string;
};

function convertKeysToLowerCase(obj: Record<string, any>) {
	if (typeof obj !== "object" || Array.isArray(obj)) {
		throw new Error("Input must be an object");
	}
	const result: Record<string, any> = {};
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			result[key.toLowerCase()] = obj[key];
		}
	}
	return result;
}

function NotFound(response: any) {
	response.send({ message: "Data not found", status: "error" });
}


async function promisifyQuery(tenantId: number, query: string, values: any[] = []): Promise<any> {
	if (!query || typeof query !== "string") {
		throw new Error("Query must be provided and of string type");
	}

	let connection;
	try {
		const pool = configuration.isMultiTenant
			? await primeTenancyConnector(tenantId)
			: databaseConnectionPool;

		const start = Date.now();
		const maxWaitMs = Number(process.env.DB_CONNECT_RETRY_MAX_MS || 60000);
		let attempt = 0;
		while (true) {
			try {
				connection = await pool.getConnection();
				break;
			} catch (err: any) {
				attempt += 1;
				const code = err?.code || '';
				const retryableCodes = new Set([
					'ECONNREFUSED',
					'PROTOCOL_CONNECTION_LOST',
					'ER_CON_COUNT_ERROR',
					'ETIMEDOUT',
					'ENOTFOUND',
					'EAI_AGAIN'
				]);

				if (!retryableCodes.has(code) || Date.now() - start > maxWaitMs) {
					throw err;
				}

				const delay = Math.min(5000, 250 * Math.pow(2, Math.min(4, attempt - 1)));
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		// Ensure legacy grouped queries are compatible on direct mysql2 pool connections.
		await connection.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))");
		const [result] = await connection.query(query, values);
		return result;
	} catch (error) {
		console.log(error);
		logger.error("Database query error:", error);
		throw error;
	} finally {
		if (connection) {
			connection.release();
		}
	}
}

async function retryableTransaction(
	fn: () => Promise<void>,
	maxRetries = 3,
	delayBetweenRetries = 1000
) {
	let retries = 0;

	async function attempt() {
		try {
			await fn();
		} catch (error: any) {
			if (error.code === "ER_LOCK_WAIT_TIMEOUT" && retries < maxRetries) {
				retries++;
				await new Promise((resolve) => setTimeout(resolve, delayBetweenRetries));
				return attempt();
			} else {
				throw error;
			}
		}
	}

	await attempt();
}

async function paginationQuery(
	pageQuery: { count?: number; page?: number },
	query: string,
	values: any[] = [],
	tenantId: number
): Promise<any> {
	const useQuery = { count: pageQuery?.count || 10, page: pageQuery?.page || 1 };
	const { count, page } = useQuery;
	const pageSize = parseInt(`${count}`);
	const currentPage = parseInt(`${page}`) - 1;
	const offset = currentPage * pageSize;
	const newValues = [...values, pageSize, offset];
	return await promisifyQuery(tenantId, query, newValues);
}



const rowAffected = (result: { affectedRows: number }): boolean =>
	result.affectedRows > 0;

const hasSpecialCharacters = (
	param: string,
	exclude?: string | string[]
): boolean => {
	if (exclude && !(typeof exclude === "string" || Array.isArray(exclude))) {
		throw new TypeError("Exclude should be a string or an array");
	}
	if (typeof exclude === "string") exclude = exclude.split("");
	let hasCharacter = false;
	const specialCharacters = [
		"!",
		"@",
		"#",
		"$",
		"%",
		"^",
		"&",
		"*",
		"(",
		")",
		"-",
		"_",
		"=",
		"+",
		"[",
		"]",
		"{",
		"}",
		";",
		":",
		'"',
		"'",
		"\\",
		"|",
		",",
		".",
		"<",
		">",
		"/",
		"?",
		"`",
		"~",
	];

	for (const char of param) {
		if (specialCharacters.includes(char)) {
			hasCharacter = exclude && exclude.includes(char) ? false : true;
		}
	}
	return hasCharacter;
};


const handleOverLoad = (func: Function) => {
	return async (req: any, res: any, next: any) => {
		try {
			await func(req, res, next);
		} catch (error) {
			next(error);
		}
	};
};
export {
	customError,
	convertKeysToLowerCase,
	responseError,
	promisifyQuery,
	NotFound,
	hasSpecialCharacters,
	removeHtmlTags,
	paginationQuery,
	handleOverLoad,
	rowAffected,
	retryableTransaction,
};
