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
	let mockManager: {
		getRepository: jest.Mock;
	};

	beforeEach(async () => {
		mockRepo = {
			save: jest.fn(),
			findOne: jest.fn(),
			update: jest.fn(),
		};
		mockManager = {
			getRepository: jest.fn().mockReturnValue(mockRepo),
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

		it('uses the transactional manager when provided', async () => {
			const media = { id: 'abc', isActive: true } as Media;
			mockRepo.save.mockResolvedValue(media);

			await mediaRepository.save(media, mockManager as never);

			expect(mockManager.getRepository).toHaveBeenCalledWith(Media);
			expect(mockRepo.save).toHaveBeenCalledWith(media);
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

		it('uses the transactional manager for updates when provided', async () => {
			mockRepo.update.mockResolvedValue(undefined);

			await mediaRepository.softDelete('abc', mockManager as never);

			expect(mockManager.getRepository).toHaveBeenCalledWith(Media);
			expect(mockRepo.update).toHaveBeenCalledWith('abc', { isActive: false });
		});
	});

	describe('updateSharedWith()', () => {
		it('calls repo.update with the provided sharedWith array', async () => {
			mockRepo.update.mockResolvedValue(undefined);
			const sharedWith = ['uid-1', 'uid-2'];

			await mediaRepository.updateSharedWith('abc', sharedWith);

			expect(mockRepo.update).toHaveBeenCalledWith('abc', { sharedWith });
		});

		it('calls repo.update with null to clear the ACL', async () => {
			mockRepo.update.mockResolvedValue(undefined);

			await mediaRepository.updateSharedWith('abc', null);

			expect(mockRepo.update).toHaveBeenCalledWith('abc', { sharedWith: null });
		});

		it('uses the transactional manager when provided', async () => {
			mockRepo.update.mockResolvedValue(undefined);

			await mediaRepository.updateSharedWith('abc', ['uid-1'], mockManager as never);

			expect(mockManager.getRepository).toHaveBeenCalledWith(Media);
			expect(mockRepo.update).toHaveBeenCalledWith('abc', { sharedWith: ['uid-1'] });
		});
	});
});
