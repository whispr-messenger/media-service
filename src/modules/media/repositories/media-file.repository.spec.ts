import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MediaFile, MediaFileStatus } from '../entities/media-file.entity';
import { MediaFileRepository } from './media-file.repository';

describe('MediaFileRepository', () => {
	let mediaFileRepository: MediaFileRepository;
	let mockRepo: {
		save: jest.Mock;
		findOne: jest.Mock;
		update: jest.Mock;
	};

	beforeEach(async () => {
		mockRepo = {
			save: jest.fn(),
			findOne: jest.fn(),
			update: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MediaFileRepository,
				{
					provide: getRepositoryToken(MediaFile),
					useValue: mockRepo,
				},
			],
		}).compile();

		mediaFileRepository = module.get<MediaFileRepository>(MediaFileRepository);
	});

	describe('save()', () => {
		it('delegates to repo.save() and returns its result', async () => {
			const mediaFile = { id: 'abc', status: MediaFileStatus.ACTIVE } as MediaFile;
			mockRepo.save.mockResolvedValue(mediaFile);

			const result = await mediaFileRepository.save(mediaFile);

			expect(mockRepo.save).toHaveBeenCalledWith(mediaFile);
			expect(result).toBe(mediaFile);
		});
	});

	describe('findById()', () => {
		it('calls repo.findOne with the correct where clause and returns the result', async () => {
			const mediaFile = { id: 'abc', status: MediaFileStatus.ACTIVE } as MediaFile;
			mockRepo.findOne.mockResolvedValue(mediaFile);

			const result = await mediaFileRepository.findById('abc');

			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { id: 'abc', status: MediaFileStatus.ACTIVE },
			});
			expect(result).toBe(mediaFile);
		});

		it('returns null when repo.findOne returns null', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			const result = await mediaFileRepository.findById('nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('softDelete()', () => {
		it('calls repo.update with DELETED status', async () => {
			mockRepo.update.mockResolvedValue(undefined);

			await mediaFileRepository.softDelete('abc');

			expect(mockRepo.update).toHaveBeenCalledWith('abc', { status: MediaFileStatus.DELETED });
		});
	});
});
