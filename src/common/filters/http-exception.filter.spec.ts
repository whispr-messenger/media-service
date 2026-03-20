import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(mockRequest: Record<string, unknown>, mockResponse: Record<string, unknown>) {
	return {
		switchToHttp: () => ({
			getResponse: () => mockResponse,
			getRequest: () => mockRequest,
		}),
	} as any;
}

describe('HttpExceptionFilter', () => {
	let filter: HttpExceptionFilter;
	let mockJson: jest.Mock;
	let mockStatus: jest.Mock;
	let mockRequest: Record<string, unknown>;
	let mockResponse: Record<string, unknown>;

	beforeEach(() => {
		mockJson = jest.fn();
		mockStatus = jest.fn().mockReturnValue({ json: mockJson });
		mockRequest = { url: '/test-path', method: 'GET' };
		mockResponse = { status: mockStatus };
		filter = new HttpExceptionFilter();
		jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
		jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
	});

	it('calls response.status(400).json() with correct shape for a 400 error', () => {
		const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
		const host = makeHost(mockRequest, mockResponse);

		filter.catch(exception, host);

		expect(mockStatus).toHaveBeenCalledWith(400);
		const body = mockJson.mock.calls[0][0];
		expect(body).toMatchObject({
			statusCode: 400,
			path: '/test-path',
			method: 'GET',
			message: 'Bad Request',
		});
		expect(body).toHaveProperty('timestamp');
	});

	it('calls response.status(404) for a 404 error', () => {
		const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
		const host = makeHost(mockRequest, mockResponse);

		filter.catch(exception, host);

		expect(mockStatus).toHaveBeenCalledWith(404);
	});

	it('calls response.status(500) for a 500 error', () => {
		const exception = new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
		const host = makeHost(mockRequest, mockResponse);

		filter.catch(exception, host);

		expect(mockStatus).toHaveBeenCalledWith(500);
	});

	it('includes a valid ISO timestamp in the response body', () => {
		const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
		const host = makeHost(mockRequest, mockResponse);

		filter.catch(exception, host);

		const body = mockJson.mock.calls[0][0];
		expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
	});

	it('sets path and method from the request object', () => {
		const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
		const customRequest = { url: '/api/media/upload', method: 'POST' };
		const host = makeHost(customRequest, mockResponse);

		filter.catch(exception, host);

		const body = mockJson.mock.calls[0][0];
		expect(body.path).toBe('/api/media/upload');
		expect(body.method).toBe('POST');
	});
});
