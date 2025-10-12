import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * Mock endpoint that simulates an external API response
 * This mimics https://api.github.com/repos/... style responses
 */
export const GET: RequestHandler = async () => {
	// Simulate external API response structure
	return json({
		id: 12345,
		name: 'test-repository',
		full_name: 'user/test-repository',
		owner: {
			login: 'testuser',
			id: 67890,
			avatar_url: 'https://avatars.githubusercontent.com/u/67890'
		},
		private: false,
		description: 'A test repository for testing external API interactions',
		created_at: '2023-01-01T00:00:00Z',
		updated_at: new Date().toISOString(),
		stargazers_count: 42,
		watchers_count: 10,
		language: 'TypeScript',
		forks_count: 5
	});
};
