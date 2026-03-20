import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Media } from '../entities/media.entity';
import { MediaRepository } from './media.repository';

describe('MediaRepository', () => {
	let mediaRepository: MediaRepository;
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
				MediaRepository,
				{
					provide: getRepositoryToken(Media),
					useValue: mockRepo,
				},
			],
		}).compile();

		mediaRepository = module.get<MediaRepository>(MediaRepository);
	});

	describe('save()', () => {
		it('delegates to repo.save() and returns its result', async () => {
			const media = { id: 'abc', isActive: true } as Media;
			mockRepo.save.mockResolvedValue(media);

			const result = await mediaRepository.save(media);

			expect(mockRepo.save).toHaveBeenCalledWith(media);
			expect(result).toBe(media);
		});
	});

	describe('findById()', () => {
		it('calls repo.findOne with the correct where clause and returns the result', async () => {
			const media = { id: 'abc', isActive: true } as Media;
			mockRepo.findOne.mockResolvedValue(media);

			const result = await mediaRepository.findById('abc');

			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { id: 'abc', isActive: true },
			});
			expect(result).toBe(media);
		});

		it('returns null when repo.findOne returns null', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			const result = await mediaRepository.findById('nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('softDelete()', () => {
		it('calls repo.update with isActive false', async () => {
			mockRepo.update.mockResolvedValue(undefined);

			await mediaRepository.softDelete('abc');

			expect(mockRepo.update).toHaveBeenCalledWith('abc', { isActive: false });
		});
	});
});
