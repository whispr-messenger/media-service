import { UserQuotaResponseDto } from './user-quota-response.dto';

describe('UserQuotaResponseDto', () => {
	it('exposes all quota fields when populated', () => {
		const dto = new UserQuotaResponseDto();
		dto.storageUsed = 100;
		dto.storageLimit = 1000;
		dto.filesCount = 1;
		dto.filesLimit = 50;
		dto.dailyUploads = 0;
		dto.dailyUploadLimit = 100;
		dto.quotaDate = '2026-05-01';
		dto.usagePercent = 10;

		expect(dto).toMatchObject({
			storageUsed: 100,
			storageLimit: 1000,
			filesCount: 1,
			filesLimit: 50,
			dailyUploads: 0,
			dailyUploadLimit: 100,
			quotaDate: '2026-05-01',
			usagePercent: 10,
		});
	});

	it('accepts a null quotaDate', () => {
		const dto = new UserQuotaResponseDto();
		dto.quotaDate = null;
		expect(dto.quotaDate).toBeNull();
	});
});
