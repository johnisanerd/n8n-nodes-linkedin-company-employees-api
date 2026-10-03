import { IDataObject, IExecuteFunctions, INodeProperties, NodeOperationError } from 'n8n-workflow';

/**
 * Normalize a string-list parameter: accept an array (the usual multiple-values UI) or a
 * single string (an expression or an AI-agent value, one entry per line), trim every entry,
 * and drop empty ones.
 */
function toStringList(value: unknown): string[] {
	const raw = Array.isArray(value)
		? value
		: typeof value === 'string'
			? value.split(/\r?\n/)
			: [];
	return raw.map((entry) => String(entry ?? '').trim()).filter((entry) => entry.length > 0);
}

/**
 * Build the Apify Actor input from node parameters.
 * Only the real Actor inputs are sent; the Output / Fields parameters shape the
 * data we return, they are not part of the Actor input.
 */
export function buildActorInput(
	context: IExecuteFunctions,
	itemIndex: number,
	defaultInput: Record<string, any>,
): Record<string, any> {
	const input: Record<string, any> = { ...defaultInput };

	const companies = toStringList(context.getNodeParameter('companies', itemIndex, []));
	if (!companies.length) {
		throw new NodeOperationError(
			context.getNode(),
			'Add at least one company: a LinkedIn company URL or a company name',
			{ itemIndex },
		);
	}
	input.companies = companies;

	const titleKeywords = toStringList(context.getNodeParameter('titleKeywords', itemIndex, []));
	if (titleKeywords.length) {
		input.titleKeywords = titleKeywords;
	}

	const locations = toStringList(context.getNodeParameter('locations', itemIndex, []));
	if (locations.length) {
		input.locations = locations;
	}

	input.maxResultsPerCompany = context.getNodeParameter('maxResultsPerCompany', itemIndex, 100);
	input.verifyEmployment = context.getNodeParameter('verifyEmployment', itemIndex, true);

	// Advanced settings are sent only when the user adds them, so the Actor's own
	// defaults apply otherwise (maxAgeDays has no default: each record type keeps its own).
	const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;
	if (options.maxSearchQueriesPerCompany !== undefined) {
		input.maxSearchQueriesPerCompany = options.maxSearchQueriesPerCompany;
	}
	if (options.maxAgeDays !== undefined) {
		input.maxAgeDays = options.maxAgeDays;
	}

	return input;
}

const showForGetMany = { show: { resource: ['employee'], operation: ['getAll'] } };

const resourceProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Employee',
				value: 'employee',
			},
		],
		default: 'employee',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['employee'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many employees',
				description: 'List the people who work at one or more companies, one item per person',
			},
		],
		default: 'getAll',
	},
];

const actorProperties: INodeProperties[] = [
	{
		displayName: 'Companies',
		name: 'companies',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Company' },
		required: true,
		default: [],
		placeholder: 'e.g. https://www.linkedin.com/company/microsoft or Microsoft',
		description:
			'LinkedIn company URLs or company names. A URL is exact; a name is matched to its LinkedIn company page first. Up to 50 per run.',
		displayOptions: showForGetMany,
	},
	{
		displayName: 'Job Title Keywords',
		name: 'titleKeywords',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Keyword' },
		default: [],
		placeholder: 'e.g. engineer',
		description:
			'Return only people whose public page mentions one of these job titles, for example engineer, sales, or head of marketing. Each keyword also runs its own search, which reaches more people. Leave empty to search built-in role slices instead. Up to 20.',
		displayOptions: showForGetMany,
	},
	{
		displayName: 'Locations',
		name: 'locations',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Location' },
		default: [],
		placeholder: 'e.g. Dublin',
		description:
			'Return only people in these cities, regions, or countries, for example Dublin or United States. People whose public profile shows a different location are left out. Leave empty to search everywhere. Up to 10.',
		displayOptions: showForGetMany,
	},
	{
		displayName: 'Max Employees per Company',
		name: 'maxResultsPerCompany',
		type: 'number',
		default: 100,
		typeOptions: { minValue: 1, maxValue: 1000 },
		description:
			'Stop after returning this many people for each company. You are charged only for people actually returned. Large companies rarely return their full headcount, since the list is limited to what public search results show.',
		displayOptions: showForGetMany,
	},
	{
		displayName: 'Verify Employment',
		name: 'verifyEmployment',
		type: 'boolean',
		default: true,
		description:
			"Whether to open each person's public LinkedIn profile and confirm a current role at the company, adding their title, location, work history, education, and photo. Turn off for a faster, cheaper list with search-level data only (name, headline, profile URL).",
		displayOptions: showForGetMany,
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: showForGetMany,
		options: [
			{
				displayName: 'Max Cached Result Age (Days)',
				name: 'maxAgeDays',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 0, maxValue: 90 },
				description:
					'Serve results fetched within this many days from the shared cache. 0 always fetches fresh. Leave this option out to keep the default for each record type.',
			},
			{
				displayName: 'Max Search Slices per Company',
				name: 'maxSearchQueriesPerCompany',
				type: 'number',
				default: 40,
				typeOptions: { minValue: 1, maxValue: 100 },
				description:
					'Cap on the public searches run per company to discover people. Each slice (a role, a title, a location) returns about ten people, so more slices reach more of a large company. Lower it for a quicker run.',
			},
		],
	},
];

const outputProperties: INodeProperties[] = [
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		noDataExpression: true,
		displayOptions: showForGetMany,
		options: [
			{
				name: 'Raw',
				value: 'raw',
				description: 'Return every field the API produces for each person',
			},
			{
				name: 'Selected Fields',
				value: 'selected',
				description: 'Choose exactly which fields to return',
			},
			{
				name: 'Simplified',
				value: 'simplified',
				description: 'Return a compact set of the most useful fields for each person',
			},
		],
		default: 'simplified',
		description: 'How much data to return for each person',
	},
	{
		displayName: 'Fields to Include',
		name: 'fields',
		type: 'multiOptions',
		displayOptions: {
			show: { resource: ['employee'], operation: ['getAll'], output: ['selected'] },
		},
		options: [
			{ name: 'About', value: 'about' },
			{ name: 'Company', value: 'companyName' },
			{ name: 'Company Slug', value: 'companySlug' },
			{ name: 'Company URL', value: 'companyUrl' },
			{ name: 'Connections', value: 'connections' },
			{ name: 'Current Company', value: 'currentCompany' },
			{ name: 'Current Title', value: 'currentTitle' },
			{ name: 'Education', value: 'education' },
			{ name: 'Error Message', value: 'error_message' },
			{ name: 'Error Type', value: 'error_type' },
			{ name: 'Fetched At', value: 'fetched_at' },
			{ name: 'Followers', value: 'followers' },
			{ name: 'Found By', value: 'foundBy' },
			{ name: 'From Cache', value: 'fromCache' },
			{ name: 'Full Name', value: 'fullName' },
			{ name: 'Headline', value: 'headline' },
			{ name: 'Location', value: 'location' },
			{ name: 'Match Reason', value: 'matchReason' },
			{ name: 'Member ID', value: 'memberId' },
			{ name: 'Photo URL', value: 'photoUrl' },
			{ name: 'Profile Slug', value: 'slug' },
			{ name: 'Profile URL', value: 'profileUrl' },
			{ name: 'Requested Company', value: 'requestedCompany' },
			{ name: 'Result Type', value: 'result_type' },
			{ name: 'Verified', value: 'verified' },
			{ name: 'Work History', value: 'positions' },
		],
		default: ['fullName', 'currentTitle', 'companyName', 'location', 'verified', 'profileUrl'],
		description: 'Which fields to return when Output is set to Selected Fields',
	},
];

const authenticationProperties: INodeProperties[] = [
	{
		displayName: 'Authentication',
		name: 'authentication',
		type: 'options',
		options: [
			{
				name: 'API Key',
				value: 'apifyApi',
			},
			{
				name: 'OAuth2',
				value: 'apifyOAuth2Api',
			},
		],
		default: 'apifyApi',
		description: 'Choose which authentication method to use',
	},
];

export const properties: INodeProperties[] = [
	...resourceProperties,
	...actorProperties,
	...outputProperties,
	...authenticationProperties,
];
