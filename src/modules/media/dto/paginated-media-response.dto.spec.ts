import { MediaItemDto, PaginatedMediaResponseDto } from './paginated-media-response.dto';

describe('PaginatedMediaResponseDto', () => {
	it('builds a media item with all fields', () => {
		const item = new MediaItemDto();
		item.id = 'm-1';
		item.contentType = 'image/png';
		item.blobSize = 1024;
		item.context = 'message';
		item.createdAt = new Date(0);
		expect(item).toMatchObject({ id: 'm-1', contentType: 'image/png', blobSize: 1024 });
	});

	it('builds a paginated response with pagination metadata', () => {
		const item = new MediaItemDto();
		item.id = 'm-1';
		item.contentType = 'image/png';
		item.blobSize = 10;
		item.context = 'message';
		item.createdAt = new Date(0);

		const response = new PaginatedMediaResponseDto();
		response.items = [item];
		response.total = 1;
		response.page = 1;
		response.limit = 20;
		response.totalPages = 1;

		expect(response.items).toHaveLength(1);
		expect(response.total).toBe(1);
		expect(response.page).toBe(1);
		expect(response.limit).toBe(20);
		expect(response.totalPages).toBe(1);
	});
});
