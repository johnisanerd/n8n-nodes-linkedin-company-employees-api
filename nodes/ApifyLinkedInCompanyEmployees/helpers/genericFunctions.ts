import {
	NodeApiError,
	NodeOperationError,
	sleep,
	type IExecuteFunctions,
	type IHookFunctions,
	type ILoadOptionsFunctions,
	type IHttpRequestOptions,
	type JsonObject,
} from 'n8n-workflow';
import { ClassNameCamel, X_PLATFORM_APP_HEADER_ID, X_PLATFORM_HEADER_ID } from '../ApifyLinkedInCompanyEmployees.node';

/**
 * Extended request options for Apify API calls
 */
type IApiRequestOptions = Omit<IHttpRequestOptions, 'url'> & {
	uri?: string;
	url?: string; // make optional to satisfy the interface
};

/**
 * Make an API request to Apify (modern version using IHttpRequestOptions)
 */
export async function apiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	requestOptions: IApiRequestOptions,
): Promise<any> {
	const { method = 'GET', qs, uri, ...rest } = requestOptions;

	const query = qs || {};
	const endpoint = `https://api.apify.com${uri ?? ''}`;

	const headers: Record<string, string> = {
		'x-apify-integration-platform': X_PLATFORM_HEADER_ID,
		...(X_PLATFORM_APP_HEADER_ID && { 'x-apify-integration-app-id': X_PLATFORM_APP_HEADER_ID }),
	};

	if (isUsedAsAiTool(this.getNode().type)) {
		headers['x-apify-integration-ai-tool'] = 'true';
	}

	// Final merged options with proper IHttpRequestOptions shape
	const options: IHttpRequestOptions = {
		...rest,
		method,
		qs: query,
		url: endpoint,
		headers,
		json: true,
	};

	// Remove body if GET
	if (method === 'GET' && 'body' in options) {
		delete options.body;
	}

	try {
		const authenticationMethod = this.getNodeParameter('authentication', 0) as string;

		try {
			await this.getCredentials(authenticationMethod);
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				`No valid credentials found for ${authenticationMethod}. Please configure them first.`,
			);
		}

		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			authenticationMethod,
			options,
		);
	} catch (error) {
		const apiError = error as JsonObject & {
			response?: { body?: unknown };
			message?: string;
		};
		const body = apiError.response?.body;
		if (body) {
			throw new NodeApiError(this.getNode(), apiError, {
				message: typeof body === 'string' ? body : JSON.stringify(body),
				description: apiError.message,
			});
		}

		throw new NodeApiError(this.getNode(), apiError);
	}
}

/**
 * Detect if used from an AI Agent tool
 */
export function isUsedAsAiTool(nodeType: string): boolean {
	const parts = nodeType.split('.');
	return parts[parts.length - 1] === `${ClassNameCamel}Tool`;
}

/**
 * Poll the Apify run until completion
 */
export async function pollRunStatus(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	runId: string,
): Promise<any> {
	let lastRunData: any;
	while (true) {
		try {
			const pollResult = await apiRequest.call(this, {
				method: 'GET',
				uri: `/v2/actor-runs/${runId}`,
			});

			const status = pollResult?.data?.status;
			lastRunData = pollResult?.data;
			if (['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(status)) break;
		} catch (err) {
			throw new NodeApiError(this.getNode(), {
				message: `Error polling run status: ${err}`,
			});
		}
		await sleep(1000);
	}
	return lastRunData;
}

/**
 * Fetch the Actor run's dataset items as a plain array (one object per job).
 * The Output-mode shaping (simplified / selected / raw) happens in runActor.
 */
export async function getResults(this: IExecuteFunctions, datasetId: string): Promise<any[]> {
	const results = await apiRequest.call(this, {
		method: 'GET',
		uri: `/v2/datasets/${datasetId}/items`,
	});

	if (Array.isArray(results)) {
		return results;
	}
	return results ? [results] : [];
}

