/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("@nestjs/swagger");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("@nestjs/config");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("helmet");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("compression");

/***/ }),
/* 7 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppModule = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const throttler_1 = __webpack_require__(8);
const core_1 = __webpack_require__(1);
const media_module_1 = __webpack_require__(9);
const auth_module_1 = __webpack_require__(37);
const grpc_module_1 = __webpack_require__(36);
const database_module_1 = __webpack_require__(38);
const cache_module_1 = __webpack_require__(39);
const auth_guard_1 = __webpack_require__(29);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            throttler_1.ThrottlerModule.forRoot({
                ttl: 60000,
                limit: 60,
            }),
            database_module_1.DatabaseModule,
            cache_module_1.CacheModule,
            auth_module_1.AuthModule,
            grpc_module_1.GrpcModule,
            media_module_1.MediaModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: auth_guard_1.AuthGuard,
            },
        ],
    })
], AppModule);


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("@nestjs/throttler");

/***/ }),
/* 9 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaModule = void 0;
const common_1 = __webpack_require__(2);
const media_service_1 = __webpack_require__(10);
const media_controller_1 = __webpack_require__(26);
const encryption_module_1 = __webpack_require__(34);
const storage_module_1 = __webpack_require__(35);
const grpc_module_1 = __webpack_require__(36);
const auth_module_1 = __webpack_require__(37);
const database_module_1 = __webpack_require__(38);
const cache_module_1 = __webpack_require__(39);
let MediaModule = class MediaModule {
};
exports.MediaModule = MediaModule;
exports.MediaModule = MediaModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            encryption_module_1.EncryptionModule,
            storage_module_1.StorageModule,
            grpc_module_1.GrpcModule,
            auth_module_1.AuthModule,
            cache_module_1.CacheModule,
        ],
        controllers: [media_controller_1.MediaController],
        providers: [media_service_1.MediaService],
        exports: [media_service_1.MediaService],
    })
], MediaModule);


/***/ }),
/* 10 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MediaService_1;
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaService = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const prisma_service_1 = __webpack_require__(11);
const encryption_service_1 = __webpack_require__(13);
const storage_service_1 = __webpack_require__(16);
const moderation_client_1 = __webpack_require__(18);
const redis_service_1 = __webpack_require__(22);
const sharp = __webpack_require__(24);
const ffmpeg = __webpack_require__(25);
const fs = __webpack_require__(15);
const path = __webpack_require__(21);
const crypto = __webpack_require__(14);
let MediaService = MediaService_1 = class MediaService {
    constructor(prisma, encryptionService, storageService, moderationClient, redisService, configService) {
        this.prisma = prisma;
        this.encryptionService = encryptionService;
        this.storageService = storageService;
        this.moderationClient = moderationClient;
        this.redisService = redisService;
        this.configService = configService;
        this.logger = new common_1.Logger(MediaService_1.name);
        this.uploadPath = this.configService.get('storage.uploadPath');
        this.tempPath = this.configService.get('storage.tempPath');
        this.maxFileSizes = {
            image: this.configService.get('storage.maxImageSize'),
            video: this.configService.get('storage.maxVideoSize'),
            audio: this.configService.get('storage.maxAudioSize'),
            document: this.configService.get('storage.maxDocumentSize'),
            default: this.configService.get('storage.maxFileSize'),
        };
    }
    async uploadFile(uploadDto) {
        const { file, userId, conversationId, messageId, categoryId, isTemporary, expiresAt } = uploadDto;
        try {
            await this.validateFileSize(file, categoryId);
            const category = await this.determineCategory(file.mimetype, categoryId);
            const fileId = crypto.randomUUID();
            const fileExtension = path.extname(file.originalname);
            const filename = `${fileId}${fileExtension}`;
            const tempFilePath = path.join(this.tempPath, filename);
            await fs.writeFile(tempFilePath, file.buffer);
            const fileHash = this.encryptionService.generateFileHash(file.buffer);
            await this.checkModerationHash(fileHash);
            try {
            }
            catch (error) {
                this.logger.warn('Erreur lors de la vérification de modération:', error);
            }
            let processedBuffer = file.buffer;
            let isCompressed = false;
            if (category.compressionEnabled) {
                const compressed = await this.compressFile(tempFilePath, file.mimetype);
                if (compressed) {
                    processedBuffer = compressed;
                    isCompressed = true;
                }
            }
            const encryptionResult = this.encryptionService.encryptBuffer(processedBuffer, userId);
            let previewData = null;
            if (category.previewEnabled) {
                previewData = await this.generatePreview(tempFilePath, file.mimetype);
            }
            const media = await this.prisma.media.create({
                data: {
                    id: fileId,
                    userId,
                    conversationId,
                    messageId,
                    categoryId: category.id,
                    originalFilename: file.originalname,
                    contentType: file.mimetype,
                    fileSize: BigInt(processedBuffer.length),
                    storagePath: `media/${fileId}`,
                    encryptionKeyHash: crypto.createHash('sha256').update(userId).digest('hex'),
                    moderationHash: fileHash,
                    isCompressed,
                    expiresAt,
                },
            });
            if (previewData && category.previewEnabled) {
                const previewEncryption = this.encryptionService.encryptBuffer(previewData, userId);
                const previewPath = `previews/${fileId}-preview`;
                await this.storageService.uploadFile({
                    fileName: previewPath,
                    buffer: previewEncryption.encryptedData,
                    contentType: this.getPreviewType(file.mimetype) === 'image' ? 'image/jpeg' : 'video/mp4',
                });
                await this.prisma.mediaPreview.create({
                    data: {
                        id: crypto.randomUUID(),
                        mediaId: fileId,
                        previewType: this.getPreviewType(file.mimetype),
                        storagePath: previewPath,
                        contentType: this.getPreviewType(file.mimetype) === 'image' ? 'image/jpeg' : 'video/mp4',
                        fileSize: BigInt(previewData.length),
                        metadata: {
                            encryptionIv: previewEncryption.iv.toString('base64'),
                            encryptionTag: previewEncryption.tag.toString('base64'),
                            encryptionSalt: previewEncryption.salt.toString('base64'),
                        },
                    },
                });
            }
            await fs.unlink(tempFilePath).catch(() => { });
            const storagePath = `media/${userId}/${filename}`;
            await this.storageService.uploadFile({
                fileName: storagePath,
                buffer: encryptionResult.encryptedData,
                contentType: file.mimetype,
            });
            await this.updateUserQuota(userId, processedBuffer.length, 'add');
            const mediaFormatted = {
                id: media.id,
                filename: media.originalFilename,
                originalName: media.originalFilename,
                mimeType: media.contentType,
                fileSize: Number(media.fileSize),
                isCompressed: media.isCompressed,
                uploadedAt: media.createdAt,
                expiresAt: media.expiresAt,
                userId: media.userId,
                conversationId: media.conversationId,
                messageId: media.messageId,
                categoryId: media.categoryId,
                isTemporary: false,
                encryptionKey: media.encryptionKeyHash,
                storageUrl: media.storagePath,
                fileHash: media.moderationHash,
            };
            return this.formatMediaResponse(media, category.previewEnabled && !!previewData);
        }
        catch (error) {
            this.logger.error(`Erreur lors de l'upload du fichier pour l'utilisateur ${userId}:`, error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('Échec de l\'upload du fichier');
        }
    }
    async getMedia(mediaId, userId) {
        const media = await this.prisma.media.findFirst({
            where: {
                id: mediaId,
                isActive: true,
            },
        });
        if (!media) {
            throw new common_1.NotFoundException('Média non trouvé');
        }
        if (media.userId !== userId) {
            const sharedMedia = await this.prisma.mediaShare?.findFirst({
                where: {
                    mediaId,
                    sharedWith: userId,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
            }).catch(() => null);
            if (!sharedMedia) {
                throw new common_1.ForbiddenException('Accès non autorisé à ce média');
            }
        }
        if (media.expiresAt && media.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Média expiré');
        }
        return Buffer.alloc(0);
    }
    async deleteMedia(mediaId, userId) {
        const media = await this.prisma.media.findFirst({
            where: {
                id: mediaId,
                isActive: true,
            },
        });
        if (!media) {
            throw new common_1.NotFoundException('Média non trouvé');
        }
        if (media.userId !== userId) {
            throw new common_1.ForbiddenException('Vous ne pouvez supprimer que vos propres médias');
        }
        await this.prisma.media.update({
            where: { id: mediaId },
            data: { isActive: false },
        });
        await this.updateUserQuota(userId, Number(media.fileSize), 'remove');
        this.logger.log(`Média ${mediaId} supprimé pour l'utilisateur ${userId}`);
    }
    async validateFileSize(file, categoryId) {
        const category = categoryId ? await this.prisma.mediaCategory.findUnique({ where: { id: categoryId } }) : null;
        const maxSize = category?.maxFileSize || this.maxFileSizes.default;
        if (file.size > maxSize) {
            throw new common_1.BadRequestException(`Fichier trop volumineux. Taille maximale: ${maxSize} bytes`);
        }
    }
    async determineCategory(mimeType, categoryId) {
        if (categoryId) {
            const category = await this.prisma.mediaCategory.findUnique({ where: { id: categoryId } });
            if (category)
                return category;
        }
        const categories = await this.prisma.mediaCategory.findMany();
        for (const category of categories) {
            const allowedTypes = category.allowedTypes;
            if (allowedTypes.includes(mimeType)) {
                return category;
            }
        }
        const defaultCategory = categories.find(c => c.name === 'document');
        if (!defaultCategory) {
            throw new common_1.BadRequestException('Aucune catégorie appropriée trouvée');
        }
        return defaultCategory;
    }
    async checkModerationHash(fileHash) {
        const blockedHash = await this.prisma.moderationHash.findFirst({
            where: {
                hashValue: fileHash,
                status: 'blocked',
            },
        });
        if (blockedHash) {
            throw new common_1.BadRequestException('Fichier bloqué par la modération');
        }
    }
    async compressFile(filePath, mimeType) {
        try {
            if (mimeType.startsWith('image/')) {
                return await this.compressImage(filePath);
            }
            else if (mimeType.startsWith('video/')) {
                return await this.compressVideo(filePath);
            }
            return null;
        }
        catch (error) {
            this.logger.warn(`Échec de la compression pour ${filePath}:`, error);
            return null;
        }
    }
    async compressImage(filePath) {
        return sharp(filePath)
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();
    }
    async compressVideo(filePath) {
        return new Promise((resolve, reject) => {
            const outputPath = `${filePath}.compressed.mp4`;
            ffmpeg(filePath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .size('1280x720')
                .videoBitrate('1000k')
                .audioBitrate('128k')
                .output(outputPath)
                .on('end', async () => {
                try {
                    const buffer = await fs.readFile(outputPath);
                    await fs.unlink(outputPath).catch(() => { });
                    resolve(buffer);
                }
                catch (error) {
                    reject(error);
                }
            })
                .on('error', reject)
                .run();
        });
    }
    async generatePreview(filePath, mimeType) {
        try {
            if (mimeType.startsWith('image/')) {
                return await this.generateImagePreview(filePath);
            }
            else if (mimeType.startsWith('video/')) {
                return await this.generateVideoPreview(filePath);
            }
            return null;
        }
        catch (error) {
            this.logger.warn(`Échec de la génération de preview pour ${filePath}:`, error);
            return null;
        }
    }
    async generateImagePreview(filePath) {
        return sharp(filePath)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toBuffer();
    }
    async generateVideoPreview(filePath) {
        return new Promise((resolve, reject) => {
            const outputPath = `${filePath}.preview.jpg`;
            ffmpeg(filePath)
                .screenshots({
                count: 1,
                folder: path.dirname(outputPath),
                filename: path.basename(outputPath),
                size: '300x300'
            })
                .on('end', async () => {
                try {
                    const buffer = await fs.readFile(outputPath);
                    await fs.unlink(outputPath).catch(() => { });
                    resolve(buffer);
                }
                catch (error) {
                    reject(error);
                }
            })
                .on('error', reject);
        });
    }
    getPreviewType(mimeType) {
        if (mimeType.startsWith('image/'))
            return 'thumbnail';
        if (mimeType.startsWith('video/'))
            return 'thumbnail';
        if (mimeType.startsWith('audio/'))
            return 'waveform';
        return 'icon';
    }
    async updateUserQuota(userId, fileSize, operation) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const quota = await this.prisma.userQuota.findUnique({
            where: { userId },
        });
        if (quota) {
            await this.prisma.userQuota.update({
                where: { userId },
                data: {
                    storageUsed: operation === 'add'
                        ? Number(quota.storageUsed) + fileSize
                        : Math.max(0, Number(quota.storageUsed) - fileSize),
                    filesCount: operation === 'add'
                        ? quota.filesCount + 1
                        : Math.max(0, quota.filesCount - 1),
                },
            });
        }
        else {
            await this.prisma.userQuota.create({
                data: {
                    id: crypto.randomUUID(),
                    userId,
                    storageUsed: operation === 'add' ? fileSize : 0,
                    filesCount: operation === 'add' ? 1 : 0,
                    quotaDate: today,
                },
            });
        }
    }
    formatMediaResponse(media, hasPreview) {
        return {
            id: media.id,
            filename: media.originalFilename,
            originalName: media.originalFilename,
            mimeType: media.contentType,
            fileSize: Number(media.fileSize),
            isCompressed: media.isCompressed,
            hasPreview,
            uploadedAt: media.createdAt,
            expiresAt: media.expiresAt,
            downloadUrl: `/api/v1/media/${media.id}/download`,
            previewUrl: hasPreview ? `/api/v1/media/${media.id}/preview` : undefined,
        };
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = MediaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof encryption_service_1.EncryptionService !== "undefined" && encryption_service_1.EncryptionService) === "function" ? _b : Object, typeof (_c = typeof storage_service_1.StorageService !== "undefined" && storage_service_1.StorageService) === "function" ? _c : Object, typeof (_d = typeof moderation_client_1.ModerationClient !== "undefined" && moderation_client_1.ModerationClient) === "function" ? _d : Object, typeof (_e = typeof redis_service_1.RedisService !== "undefined" && redis_service_1.RedisService) === "function" ? _e : Object, typeof (_f = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _f : Object])
], MediaService);


/***/ }),
/* 11 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PrismaService = void 0;
const common_1 = __webpack_require__(2);
const client_1 = __webpack_require__(12);
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super({
            log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
            errorFormat: 'pretty',
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
    async enableShutdownHooks(app) {
    }
    async cleanDatabase() {
        if (process.env.NODE_ENV === 'test') {
            const tablenames = await this.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'");
            const tables = tablenames
                .map(({ tablename }) => tablename)
                .filter((name) => name !== '_prisma_migrations')
                .map((name) => `"public"."${name}"`)
                .join(', ');
            try {
                await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
            }
            catch (error) {
                console.log({ error });
            }
        }
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);


/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),
/* 13 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EncryptionService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EncryptionService = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const crypto = __webpack_require__(14);
const fs = __webpack_require__(15);
let EncryptionService = EncryptionService_1 = class EncryptionService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EncryptionService_1.name);
        this.algorithm = this.configService.get('encryption.algorithm');
        this.keyLength = this.configService.get('encryption.keyLength');
        this.ivLength = this.configService.get('encryption.ivLength');
        this.tagLength = this.configService.get('encryption.tagLength');
        this.saltLength = this.configService.get('encryption.saltLength');
        this.iterations = this.configService.get('encryption.iterations');
        this.masterKey = this.configService.get('encryption.masterKey');
    }
    deriveKey(userKey, salt) {
        const combinedKey = `${this.masterKey}:${userKey}`;
        return crypto.pbkdf2Sync(combinedKey, salt, this.iterations, this.keyLength, 'sha256');
    }
    async encryptFile(filePath, userKey) {
        try {
            const data = await fs.readFile(filePath);
            return this.encryptBuffer(data, userKey);
        }
        catch (error) {
            this.logger.error(`Erreur lors du chiffrement du fichier ${filePath}:`, error);
            throw new Error('Échec du chiffrement du fichier');
        }
    }
    encryptBuffer(data, userKey) {
        try {
            const salt = crypto.randomBytes(this.saltLength);
            const iv = crypto.randomBytes(this.ivLength);
            const key = this.deriveKey(userKey, salt);
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            cipher.setAAD(salt);
            const encrypted = Buffer.concat([
                cipher.update(data),
                cipher.final()
            ]);
            const tag = cipher.getAuthTag();
            return {
                encryptedData: encrypted,
                iv,
                tag,
                salt
            };
        }
        catch (error) {
            this.logger.error('Erreur lors du chiffrement:', error);
            throw new Error('Échec du chiffrement des données');
        }
    }
    async decryptFile(params, outputPath) {
        try {
            const decryptedData = this.decryptBuffer(params);
            await fs.writeFile(outputPath, decryptedData);
        }
        catch (error) {
            this.logger.error(`Erreur lors du déchiffrement vers ${outputPath}:`, error);
            throw new Error('Échec du déchiffrement du fichier');
        }
    }
    decryptBuffer(params) {
        try {
            const { encryptedData, iv, tag, salt, userKey } = params;
            const key = this.deriveKey(userKey, salt);
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(tag);
            decipher.setAAD(salt);
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            return decrypted;
        }
        catch (error) {
            this.logger.error('Erreur lors du déchiffrement:', error);
            throw new Error('Échec du déchiffrement des données');
        }
    }
    generateFileHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    async generateFileHashFromPath(filePath) {
        try {
            const data = await fs.readFile(filePath);
            return this.generateFileHash(data);
        }
        catch (error) {
            this.logger.error(`Erreur lors du calcul du hash pour ${filePath}:`, error);
            throw new Error('Échec du calcul du hash du fichier');
        }
    }
    verifyIntegrity(originalHash, data) {
        const currentHash = this.generateFileHash(data);
        return originalHash === currentHash;
    }
    async createEncryptedMetadata(metadata, userKey) {
        try {
            const jsonData = JSON.stringify(metadata);
            const buffer = Buffer.from(jsonData, 'utf8');
            const encrypted = this.encryptBuffer(buffer, userKey);
            const combined = {
                data: encrypted.encryptedData.toString('base64'),
                iv: encrypted.iv.toString('base64'),
                tag: encrypted.tag.toString('base64'),
                salt: encrypted.salt.toString('base64')
            };
            return Buffer.from(JSON.stringify(combined)).toString('base64');
        }
        catch (error) {
            this.logger.error('Erreur lors du chiffrement des métadonnées:', error);
            throw new Error('Échec du chiffrement des métadonnées');
        }
    }
    async decryptMetadata(encryptedMetadata, userKey) {
        try {
            const combined = JSON.parse(Buffer.from(encryptedMetadata, 'base64').toString('utf8'));
            const params = {
                encryptedData: Buffer.from(combined.data, 'base64'),
                iv: Buffer.from(combined.iv, 'base64'),
                tag: Buffer.from(combined.tag, 'base64'),
                salt: Buffer.from(combined.salt, 'base64'),
                userKey
            };
            const decrypted = this.decryptBuffer(params);
            return JSON.parse(decrypted.toString('utf8'));
        }
        catch (error) {
            this.logger.error('Erreur lors du déchiffrement des métadonnées:', error);
            throw new Error('Échec du déchiffrement des métadonnées');
        }
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = EncryptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], EncryptionService);


/***/ }),
/* 14 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 15 */
/***/ ((module) => {

module.exports = require("fs/promises");

/***/ }),
/* 16 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StorageService = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const storage_1 = __webpack_require__(17);
let StorageService = StorageService_1 = class StorageService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(StorageService_1.name);
        this.projectId = this.configService.get('storage.gcs.projectId');
        this.bucketName = this.configService.get('storage.gcs.bucketName');
        const keyFilename = this.configService.get('storage.gcs.keyFilename');
        this.storage = new storage_1.Storage({
            projectId: this.projectId,
            keyFilename,
        });
    }
    async uploadFile(options) {
        const { fileName, buffer, contentType, metadata } = options;
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);
            const stream = file.createWriteStream({
                metadata: {
                    contentType: contentType || 'application/octet-stream',
                    metadata: metadata || {},
                },
                resumable: false,
            });
            return new Promise((resolve, reject) => {
                stream.on('error', (error) => {
                    this.logger.error(`Erreur lors de l'upload vers GCS: ${error.message}`, error);
                    reject(new common_1.InternalServerErrorException('Échec de l\'upload vers le stockage'));
                });
                stream.on('finish', () => {
                    this.logger.log(`Fichier ${fileName} uploadé avec succès vers GCS`);
                    resolve(fileName);
                });
                stream.end(buffer);
            });
        }
        catch (error) {
            this.logger.error(`Erreur lors de l'upload du fichier ${fileName}:`, error);
            throw new common_1.InternalServerErrorException('Échec de l\'upload vers le stockage');
        }
    }
    async downloadFile(fileName) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);
            const [exists] = await file.exists();
            if (!exists) {
                throw new Error(`Fichier ${fileName} non trouvé dans le stockage`);
            }
            const [buffer] = await file.download();
            const [metadata] = await file.getMetadata();
            this.logger.log(`Fichier ${fileName} téléchargé avec succès depuis GCS`);
            return {
                buffer,
                metadata: metadata.metadata || {},
            };
        }
        catch (error) {
            this.logger.error(`Erreur lors du téléchargement du fichier ${fileName}:`, error);
            throw new common_1.InternalServerErrorException('Échec du téléchargement depuis le stockage');
        }
    }
    async deleteFile(fileName) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);
            await file.delete();
            this.logger.log(`Fichier ${fileName} supprimé avec succès de GCS`);
        }
        catch (error) {
            this.logger.error(`Erreur lors de la suppression du fichier ${fileName}:`, error);
            throw new common_1.InternalServerErrorException('Échec de la suppression du fichier');
        }
    }
    async fileExists(fileName) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);
            const [exists] = await file.exists();
            return exists;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la vérification d'existence du fichier ${fileName}:`, error);
            return false;
        }
    }
    async getFileMetadata(fileName) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);
            const [metadata] = await file.getMetadata();
            return metadata.metadata || {};
        }
        catch (error) {
            this.logger.error(`Erreur lors de la récupération des métadonnées du fichier ${fileName}:`, error);
            throw new common_1.InternalServerErrorException('Échec de la récupération des métadonnées');
        }
    }
    generateStoragePath(userId, fileId, extension) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `users/${userId}/${year}/${month}/${day}/${fileId}${extension}`;
    }
    generatePreviewPath(userId, fileId) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `previews/${userId}/${year}/${month}/${day}/${fileId}.jpg`;
    }
    async uploadEncryptedFile(userId, fileId, encryptedBuffer, originalExtension, metadata) {
        const storagePath = this.generateStoragePath(userId, fileId, '.enc');
        const uploadOptions = {
            fileName: storagePath,
            buffer: encryptedBuffer,
            contentType: 'application/octet-stream',
            metadata: {
                ...metadata,
                originalExtension,
                encrypted: 'true',
                userId,
                fileId,
            },
        };
        return this.uploadFile(uploadOptions);
    }
    async uploadEncryptedPreview(userId, fileId, encryptedPreviewBuffer, metadata) {
        const previewPath = this.generatePreviewPath(userId, fileId);
        const uploadOptions = {
            fileName: previewPath,
            buffer: encryptedPreviewBuffer,
            contentType: 'application/octet-stream',
            metadata: {
                ...metadata,
                encrypted: 'true',
                preview: 'true',
                userId,
                fileId,
            },
        };
        return this.uploadFile(uploadOptions);
    }
    async cleanupExpiredFiles() {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const [files] = await bucket.getFiles();
            let deletedCount = 0;
            const now = new Date();
            for (const file of files) {
                try {
                    const [metadata] = await file.getMetadata();
                    const expiresAt = metadata.metadata?.expiresAt;
                    if (expiresAt && new Date(expiresAt) < now) {
                        await file.delete();
                        deletedCount++;
                        this.logger.log(`Fichier expiré supprimé: ${file.name}`);
                    }
                }
                catch (error) {
                    this.logger.warn(`Erreur lors de la vérification d'expiration pour ${file.name}:`, error);
                }
            }
            this.logger.log(`Nettoyage terminé: ${deletedCount} fichiers expirés supprimés`);
            return deletedCount;
        }
        catch (error) {
            this.logger.error('Erreur lors du nettoyage des fichiers expirés:', error);
            throw new common_1.InternalServerErrorException('Échec du nettoyage des fichiers expirés');
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], StorageService);


/***/ }),
/* 17 */
/***/ ((module) => {

module.exports = require("@google-cloud/storage");

/***/ }),
/* 18 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ModerationClient_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ModerationClient = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const grpc = __webpack_require__(19);
const protoLoader = __webpack_require__(20);
const path = __webpack_require__(21);
let ModerationClient = ModerationClient_1 = class ModerationClient {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ModerationClient_1.name);
        this.moderationServiceUrl = this.configService.get('grpc.moderationService.url', 'localhost:50052');
    }
    async onModuleInit() {
        try {
            const protoPath = path.join(__dirname, '../../../proto/moderation.proto');
            const packageDefinition = protoLoader.loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            });
            const moderationProto = grpc.loadPackageDefinition(packageDefinition).moderation;
            this.client = new moderationProto.ModerationService(this.moderationServiceUrl, grpc.credentials.createInsecure());
            this.logger.log(`Client gRPC Moderation connecté à ${this.moderationServiceUrl}`);
        }
        catch (error) {
            this.logger.error('Erreur lors de l\'initialisation du client Moderation gRPC:', error);
        }
    }
    async checkContent(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Moderation non initialisé'));
                return;
            }
            const grpcRequest = {
                content_id: request.contentId,
                content_type: request.contentType,
                file_hash: request.fileHash,
                content_data: request.contentData,
                user_id: request.userId,
            };
            this.client.CheckContent(grpcRequest, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors de la vérification du contenu:', error);
                    resolve({
                        approved: false,
                        status: 'error',
                        reason: error.message,
                        flags: [],
                        moderationId: '',
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        approved: response.approved,
                        status: response.status,
                        reason: response.reason,
                        flags: response.flags || [],
                        moderationId: response.moderation_id,
                        error: response.error,
                    });
                }
            });
        });
    }
    async reportContent(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Moderation non initialisé'));
                return;
            }
            const grpcRequest = {
                content_id: request.contentId,
                reporter_id: request.reporterId,
                reason: request.reason,
                description: request.description,
            };
            this.client.ReportContent(grpcRequest, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors du signalement du contenu:', error);
                    resolve({
                        reportId: '',
                        success: false,
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        reportId: response.report_id,
                        success: response.success,
                        error: response.error,
                    });
                }
            });
        });
    }
    async getModerationStatus(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Moderation non initialisé'));
                return;
            }
            this.client.GetModerationStatus({ content_id: request.contentId }, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors de la récupération du statut de modération:', error);
                    resolve({
                        contentId: request.contentId,
                        status: 'error',
                        reason: error.message,
                        checkedAt: 0,
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        contentId: response.content_id,
                        status: response.status,
                        reason: response.reason,
                        checkedAt: parseInt(response.checked_at),
                        moderatorId: response.moderator_id,
                        error: response.error,
                    });
                }
            });
        });
    }
    async addBlockedHash(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Moderation non initialisé'));
                return;
            }
            const grpcRequest = {
                hash_value: request.hashValue,
                hash_type: request.hashType,
                reason: request.reason,
                added_by: request.addedBy,
            };
            this.client.AddBlockedHash(grpcRequest, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors de l\'ajout du hash bloqué:', error);
                    resolve({
                        success: false,
                        hashId: '',
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        success: response.success,
                        hashId: response.hash_id,
                        error: response.error,
                    });
                }
            });
        });
    }
    async healthCheck() {
        try {
            const response = await this.getModerationStatus({ contentId: 'health-check' });
            return response.error !== undefined;
        }
        catch (error) {
            this.logger.warn('Service Moderation gRPC non accessible:', error);
            return false;
        }
    }
};
exports.ModerationClient = ModerationClient;
exports.ModerationClient = ModerationClient = ModerationClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], ModerationClient);


/***/ }),
/* 19 */
/***/ ((module) => {

module.exports = require("@grpc/grpc-js");

/***/ }),
/* 20 */
/***/ ((module) => {

module.exports = require("@grpc/proto-loader");

/***/ }),
/* 21 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 22 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RedisService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RedisService = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const redis_1 = __webpack_require__(23);
let RedisService = RedisService_1 = class RedisService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RedisService_1.name);
        this.defaultTTL = 3600;
        const redisUrl = this.configService.get('REDIS_URL', 'redis://localhost:6379');
        this.client = (0, redis_1.createClient)({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        this.logger.error('Trop de tentatives de reconnexion Redis, abandon');
                        return new Error('Trop de tentatives de reconnexion');
                    }
                    return Math.min(retries * 100, 3000);
                },
            },
        });
        this.client.on('error', (error) => {
            this.logger.error('Erreur Redis:', error);
        });
        this.client.on('connect', () => {
            this.logger.log('Connexion à Redis établie');
        });
        this.client.on('disconnect', () => {
            this.logger.warn('Connexion à Redis fermée');
        });
    }
    async onModuleInit() {
        try {
            await this.client.connect();
            this.logger.log('Service Redis initialisé avec succès');
        }
        catch (error) {
            this.logger.error('Erreur lors de l\'initialisation de Redis:', error);
        }
    }
    async onModuleDestroy() {
        try {
            await this.client.quit();
            this.logger.log('Connexion Redis fermée proprement');
        }
        catch (error) {
            this.logger.error('Erreur lors de la fermeture de Redis:', error);
        }
    }
    async getUserQuota(userId) {
        try {
            const key = `quota:${userId}`;
            const data = await this.client.get(key);
            if (!data) {
                return null;
            }
            const quota = JSON.parse(data);
            return {
                ...quota,
                lastUpdated: new Date(quota.lastUpdated)
            };
        }
        catch (error) {
            this.logger.error(`Erreur lors de la récupération du quota pour ${userId}:`, error);
            return null;
        }
    }
    async setUserQuota(quota, ttl = this.defaultTTL) {
        try {
            const key = `quota:${quota.userId}`;
            const data = JSON.stringify({
                ...quota,
                lastUpdated: new Date(),
            });
            await this.client.setEx(key, ttl, data);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la sauvegarde du quota pour ${quota.userId}:`, error);
            return false;
        }
    }
    async updateUserQuota(userId, sizeChange, fileCountChange) {
        try {
            const currentQuota = await this.getUserQuota(userId);
            const updatedQuota = {
                userId,
                totalSize: (currentQuota?.totalSize || 0) + sizeChange,
                fileCount: (currentQuota?.fileCount || 0) + fileCountChange,
                lastUpdated: new Date(),
            };
            return await this.setUserQuota(updatedQuota);
        }
        catch (error) {
            this.logger.error(`Erreur lors de la mise à jour du quota pour ${userId}:`, error);
            return false;
        }
    }
    async deleteUserQuota(userId) {
        try {
            const key = `quota:${userId}`;
            await this.client.del(key);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la suppression du quota pour ${userId}:`, error);
            return false;
        }
    }
    async getMediaMetadata(mediaId) {
        try {
            const key = `media:${mediaId}`;
            const data = await this.client.get(key);
            if (!data) {
                return null;
            }
            const metadata = JSON.parse(data);
            metadata.uploadedAt = new Date(metadata.uploadedAt);
            if (metadata.expiresAt) {
                metadata.expiresAt = new Date(metadata.expiresAt);
            }
            return metadata;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la récupération des métadonnées pour ${mediaId}:`, error);
            return null;
        }
    }
    async setMediaMetadata(metadata, ttl = this.defaultTTL) {
        try {
            const key = `media:${metadata.id}`;
            const data = JSON.stringify(metadata);
            await this.client.setEx(key, ttl, data);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la sauvegarde des métadonnées pour ${metadata.id}:`, error);
            return false;
        }
    }
    async deleteMediaMetadata(mediaId) {
        try {
            const key = `media:${mediaId}`;
            await this.client.del(key);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la suppression des métadonnées pour ${mediaId}:`, error);
            return false;
        }
    }
    async createDownloadSession(mediaId, userId, expiresIn = 300) {
        try {
            const sessionId = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const key = `download:${sessionId}`;
            const data = JSON.stringify({ mediaId, userId, createdAt: new Date() });
            await this.client.setEx(key, expiresIn, data);
            return sessionId;
        }
        catch (error) {
            this.logger.error('Erreur lors de la création de session de téléchargement:', error);
            throw error;
        }
    }
    async getDownloadSession(sessionId) {
        try {
            const key = `download:${sessionId}`;
            const data = await this.client.get(key);
            if (!data) {
                return null;
            }
            const session = JSON.parse(data);
            session.createdAt = new Date(session.createdAt);
            return session;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la récupération de session ${sessionId}:`, error);
            return null;
        }
    }
    async deleteDownloadSession(sessionId) {
        try {
            const key = `download:${sessionId}`;
            await this.client.del(key);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la suppression de session ${sessionId}:`, error);
            return false;
        }
    }
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            await this.client.setEx(key, ttl, data);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la sauvegarde de ${key}:`, error);
            return false;
        }
    }
    async get(key) {
        try {
            const data = await this.client.get(key);
            if (!data) {
                return null;
            }
            try {
                return JSON.parse(data);
            }
            catch {
                return data;
            }
        }
        catch (error) {
            this.logger.error(`Erreur lors de la récupération de ${key}:`, error);
            return null;
        }
    }
    async delete(key) {
        try {
            await this.client.del(key);
            return true;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la suppression de ${key}:`, error);
            return false;
        }
    }
    async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            this.logger.error(`Erreur lors de la vérification d'existence de ${key}:`, error);
            return false;
        }
    }
    async flushAll() {
        try {
            await this.client.flushAll();
            this.logger.log('Cache Redis vidé');
            return true;
        }
        catch (error) {
            this.logger.error('Erreur lors du vidage du cache:', error);
            return false;
        }
    }
    async healthCheck() {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch (error) {
            this.logger.error('Erreur lors du health check Redis:', error);
            return false;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], RedisService);


/***/ }),
/* 23 */
/***/ ((module) => {

module.exports = require("redis");

/***/ }),
/* 24 */
/***/ ((module) => {

module.exports = require("sharp");

/***/ }),
/* 25 */
/***/ ((module) => {

module.exports = require("fluent-ffmpeg");

/***/ }),
/* 26 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaController = void 0;
const common_1 = __webpack_require__(2);
const platform_express_1 = __webpack_require__(27);
const swagger_1 = __webpack_require__(3);
const express_1 = __webpack_require__(28);
const media_service_1 = __webpack_require__(10);
const auth_guard_1 = __webpack_require__(29);
const permission_guard_1 = __webpack_require__(31);
const permissions_decorator_1 = __webpack_require__(32);
const public_decorator_1 = __webpack_require__(33);
let MediaController = class MediaController {
    constructor(mediaService) {
        this.mediaService = mediaService;
    }
    async uploadFile(file, body, req) {
        if (!file) {
            throw new common_1.BadRequestException('Aucun fichier fourni');
        }
        const userId = req.user.id;
        const uploadDto = {
            file,
            userId: userId,
            conversationId: body.conversationId,
            messageId: body.messageId,
            categoryId: body.categoryId,
            isTemporary: body.isTemporary === 'true',
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        };
        return this.mediaService.uploadFile(uploadDto);
    }
    async downloadFile(mediaId, res, req) {
        const userId = req.user.id;
        try {
            const fileBuffer = await this.mediaService.getMedia(mediaId, userId);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${mediaId}"`);
            res.send(fileBuffer);
        }
        catch (error) {
            throw new common_1.BadRequestException('Erreur lors du téléchargement du fichier');
        }
    }
    async getPreview(mediaId, res) {
        try {
            const previewBuffer = Buffer.alloc(0);
            res.setHeader('Content-Type', 'image/jpeg');
            res.send(previewBuffer);
        }
        catch (error) {
            throw new common_1.BadRequestException('Erreur lors de la récupération de la preview');
        }
    }
    async deleteFile(mediaId, req) {
        const userId = req.user.id;
        await this.mediaService.deleteMedia(mediaId, userId);
    }
    async getMyMedia(req, page = 1, limit = 10, category) {
        const userId = req.user.id;
        return {
            data: [],
            pagination: {
                page: page,
                limit: limit,
                total: 0,
                totalPages: 0,
            },
        };
    }
    async getUserMedia(userId, page = 1, limit = 10, category) {
        return {
            data: [],
            pagination: {
                page: page,
                limit: limit,
                total: 0,
                totalPages: 0,
            },
        };
    }
    async getCategories() {
        return [];
    }
};
exports.MediaController = MediaController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, permissions_decorator_1.RequirePermissions)(permissions_decorator_1.MediaPermissions.UPLOAD),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a media file' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                userId: {
                    type: 'string',
                    description: 'ID of the user uploading the file',
                },
                conversationId: {
                    type: 'string',
                    description: 'Optional conversation ID',
                },
                messageId: {
                    type: 'string',
                    description: 'Optional message ID',
                },
                categoryId: {
                    type: 'string',
                    description: 'Optional category ID',
                },
                isTemporary: {
                    type: 'boolean',
                    description: 'Whether the file is temporary',
                },
                expiresAt: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Optional expiration date',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'File uploaded successfully',
        type: 'object',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Bad request - invalid file or parameters',
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: {
            fileSize: 100 * 1024 * 1024,
        },
        fileFilter: (req, file, callback) => {
            const allowedMimes = [
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/heic',
                'video/mp4',
                'video/quicktime',
                'video/x-msvideo',
                'audio/mpeg',
                'audio/wav',
                'audio/aac',
                'audio/ogg',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'application/zip',
                'application/x-rar-compressed',
            ];
            if (allowedMimes.includes(file.mimetype)) {
                callback(null, true);
            }
            else {
                callback(new common_1.BadRequestException('Type de fichier non autorisé'), false);
            }
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof Express !== "undefined" && (_b = Express.Multer) !== void 0 && _b.File) === "function" ? _c : Object, Object, Object]),
    __metadata("design:returntype", typeof (_d = typeof Promise !== "undefined" && Promise) === "function" ? _d : Object)
], MediaController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, permissions_decorator_1.RequirePermissions)(permissions_decorator_1.MediaPermissions.DOWNLOAD),
    (0, swagger_1.ApiOperation)({ summary: 'Download a media file' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'File downloaded successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'File not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_e = typeof express_1.Response !== "undefined" && express_1.Response) === "function" ? _e : Object, Object]),
    __metadata("design:returntype", typeof (_f = typeof Promise !== "undefined" && Promise) === "function" ? _f : Object)
], MediaController.prototype, "downloadFile", null);
__decorate([
    (0, common_1.Get)(':id/preview'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get media preview' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Preview retrieved successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Preview not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_g = typeof express_1.Response !== "undefined" && express_1.Response) === "function" ? _g : Object]),
    __metadata("design:returntype", typeof (_h = typeof Promise !== "undefined" && Promise) === "function" ? _h : Object)
], MediaController.prototype, "getPreview", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, permissions_decorator_1.RequirePermissions)(permissions_decorator_1.MediaPermissions.DELETE),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a media file' }),
    (0, swagger_1.ApiResponse)({
        status: 204,
        description: 'File deleted successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'File not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", typeof (_j = typeof Promise !== "undefined" && Promise) === "function" ? _j : Object)
], MediaController.prototype, "deleteFile", null);
__decorate([
    (0, common_1.Get)('my-media'),
    (0, swagger_1.ApiOperation)({ summary: 'Get my media files' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false, type: String }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'My media files retrieved successfully',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page', new common_1.ParseIntPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __param(3, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, String]),
    __metadata("design:returntype", typeof (_k = typeof Promise !== "undefined" && Promise) === "function" ? _k : Object)
], MediaController.prototype, "getMyMedia", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    (0, permissions_decorator_1.RequirePermissions)(permissions_decorator_1.MediaPermissions.VIEW_ALL),
    (0, swagger_1.ApiOperation)({ summary: 'Get user media files (admin)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false, type: String }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'User media files retrieved successfully',
    }),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('page', new common_1.ParseIntPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __param(3, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, String]),
    __metadata("design:returntype", typeof (_l = typeof Promise !== "undefined" && Promise) === "function" ? _l : Object)
], MediaController.prototype, "getUserMedia", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get available media categories' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Categories retrieved successfully',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", typeof (_m = typeof Promise !== "undefined" && Promise) === "function" ? _m : Object)
], MediaController.prototype, "getCategories", null);
exports.MediaController = MediaController = __decorate([
    (0, swagger_1.ApiTags)('Media'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permission_guard_1.PermissionGuard),
    (0, common_1.Controller)('media'),
    __metadata("design:paramtypes", [typeof (_a = typeof media_service_1.MediaService !== "undefined" && media_service_1.MediaService) === "function" ? _a : Object])
], MediaController);


/***/ }),
/* 27 */
/***/ ((module) => {

module.exports = require("@nestjs/platform-express");

/***/ }),
/* 28 */
/***/ ((module) => {

module.exports = require("express");

/***/ }),
/* 29 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthGuard_1;
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthGuard = exports.IS_PUBLIC_KEY = void 0;
const common_1 = __webpack_require__(2);
const core_1 = __webpack_require__(1);
const auth_client_1 = __webpack_require__(30);
exports.IS_PUBLIC_KEY = 'isPublic';
let AuthGuard = AuthGuard_1 = class AuthGuard {
    constructor(authClient, reflector) {
        this.authClient = authClient;
        this.reflector = reflector;
        this.logger = new common_1.Logger(AuthGuard_1.name);
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(exports.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new common_1.UnauthorizedException('Token d\'authentification manquant');
        }
        try {
            const validation = await this.authClient.validateToken({ token });
            if (!validation.valid) {
                throw new common_1.UnauthorizedException(validation.error || 'Token d\'authentification invalide');
            }
            const userInfo = await this.authClient.getUserInfo({
                userId: validation.userId,
            });
            if (userInfo.error || !userInfo.active) {
                throw new common_1.UnauthorizedException('Utilisateur inactif ou introuvable');
            }
            request.user = {
                id: userInfo.userId,
                email: userInfo.email,
                username: userInfo.username,
                roles: userInfo.roles,
            };
            return true;
        }
        catch (error) {
            this.logger.error('Erreur lors de la validation du token:', error);
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            throw new common_1.UnauthorizedException('Erreur d\'authentification');
        }
    }
    extractTokenFromHeader(request) {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = AuthGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof auth_client_1.AuthClient !== "undefined" && auth_client_1.AuthClient) === "function" ? _a : Object, typeof (_b = typeof core_1.Reflector !== "undefined" && core_1.Reflector) === "function" ? _b : Object])
], AuthGuard);


/***/ }),
/* 30 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthClient_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthClient = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const grpc = __webpack_require__(19);
const protoLoader = __webpack_require__(20);
const path = __webpack_require__(21);
let AuthClient = AuthClient_1 = class AuthClient {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(AuthClient_1.name);
        this.authServiceUrl = this.configService.get('grpc.authService.url', 'localhost:50051');
    }
    async onModuleInit() {
        try {
            const protoPath = path.join(__dirname, '../../../proto/auth.proto');
            const packageDefinition = protoLoader.loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            });
            const authProto = grpc.loadPackageDefinition(packageDefinition).auth;
            this.client = new authProto.AuthService(this.authServiceUrl, grpc.credentials.createInsecure());
            this.logger.log(`Client gRPC Auth connecté à ${this.authServiceUrl}`);
        }
        catch (error) {
            this.logger.error('Erreur lors de l\'initialisation du client Auth gRPC:', error);
        }
    }
    async validateToken(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Auth non initialisé'));
                return;
            }
            this.client.ValidateToken(request, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors de la validation du token:', error);
                    resolve({
                        valid: false,
                        userId: '',
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        valid: response.valid,
                        userId: response.user_id,
                        error: response.error,
                    });
                }
            });
        });
    }
    async getUserInfo(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Auth non initialisé'));
                return;
            }
            this.client.GetUserInfo({ user_id: request.userId }, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors de la récupération des infos utilisateur:', error);
                    resolve({
                        userId: request.userId,
                        email: '',
                        username: '',
                        roles: [],
                        active: false,
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        userId: response.user_id,
                        email: response.email,
                        username: response.username,
                        roles: response.roles || [],
                        active: response.active,
                        error: response.error,
                    });
                }
            });
        });
    }
    async checkPermission(request) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client gRPC Auth non initialisé'));
                return;
            }
            const grpcRequest = {
                user_id: request.userId,
                resource: request.resource,
                action: request.action,
            };
            this.client.CheckPermission(grpcRequest, (error, response) => {
                if (error) {
                    this.logger.error('Erreur lors de la vérification des permissions:', error);
                    resolve({
                        allowed: false,
                        error: error.message,
                    });
                }
                else {
                    resolve({
                        allowed: response.allowed,
                        error: response.error,
                    });
                }
            });
        });
    }
    async healthCheck() {
        try {
            const response = await this.validateToken({ token: 'health-check' });
            return response.error !== undefined;
        }
        catch (error) {
            this.logger.warn('Service Auth gRPC non accessible:', error);
            return false;
        }
    }
};
exports.AuthClient = AuthClient;
exports.AuthClient = AuthClient = AuthClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], AuthClient);


/***/ }),
/* 31 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PermissionGuard_1;
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PermissionGuard = exports.PERMISSIONS_KEY = void 0;
const common_1 = __webpack_require__(2);
const core_1 = __webpack_require__(1);
const auth_client_1 = __webpack_require__(30);
exports.PERMISSIONS_KEY = 'permissions';
let PermissionGuard = PermissionGuard_1 = class PermissionGuard {
    constructor(authClient, reflector) {
        this.authClient = authClient;
        this.reflector = reflector;
        this.logger = new common_1.Logger(PermissionGuard_1.name);
    }
    async canActivate(context) {
        const requiredPermissions = this.reflector.getAllAndOverride(exports.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('Utilisateur non authentifié');
        }
        try {
            for (const permission of requiredPermissions) {
                const permissionCheck = await this.authClient.checkPermission({
                    userId: user.id,
                    resource: permission.resource,
                    action: permission.action,
                });
                if (permissionCheck.error) {
                    this.logger.error(`Erreur lors de la vérification de permission: ${permissionCheck.error}`);
                    throw new common_1.ForbiddenException('Erreur de vérification des permissions');
                }
                if (!permissionCheck.allowed) {
                    throw new common_1.ForbiddenException(`Permission refusée: ${permission.action} sur ${permission.resource}`);
                }
            }
            return true;
        }
        catch (error) {
            this.logger.error('Erreur lors de la vérification des permissions:', error);
            if (error instanceof common_1.ForbiddenException) {
                throw error;
            }
            throw new common_1.ForbiddenException('Erreur de vérification des permissions');
        }
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = PermissionGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof auth_client_1.AuthClient !== "undefined" && auth_client_1.AuthClient) === "function" ? _a : Object, typeof (_b = typeof core_1.Reflector !== "undefined" && core_1.Reflector) === "function" ? _b : Object])
], PermissionGuard);


/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaPermissions = exports.RequirePermissions = void 0;
const common_1 = __webpack_require__(2);
const permission_guard_1 = __webpack_require__(31);
const RequirePermissions = (...permissions) => (0, common_1.SetMetadata)(permission_guard_1.PERMISSIONS_KEY, permissions);
exports.RequirePermissions = RequirePermissions;
exports.MediaPermissions = {
    UPLOAD: { resource: 'media', action: 'upload' },
    DOWNLOAD: { resource: 'media', action: 'download' },
    DELETE: { resource: 'media', action: 'delete' },
    VIEW_ALL: { resource: 'media', action: 'view_all' },
    MODERATE: { resource: 'media', action: 'moderate' },
    ADMIN: { resource: 'media', action: 'admin' },
};


/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Public = void 0;
const common_1 = __webpack_require__(2);
const auth_guard_1 = __webpack_require__(29);
const Public = () => (0, common_1.SetMetadata)(auth_guard_1.IS_PUBLIC_KEY, true);
exports.Public = Public;


/***/ }),
/* 34 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EncryptionModule = void 0;
const common_1 = __webpack_require__(2);
const encryption_service_1 = __webpack_require__(13);
let EncryptionModule = class EncryptionModule {
};
exports.EncryptionModule = EncryptionModule;
exports.EncryptionModule = EncryptionModule = __decorate([
    (0, common_1.Module)({
        providers: [encryption_service_1.EncryptionService],
        exports: [encryption_service_1.EncryptionService],
    })
], EncryptionModule);


/***/ }),
/* 35 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StorageModule = void 0;
const common_1 = __webpack_require__(2);
const storage_service_1 = __webpack_require__(16);
let StorageModule = class StorageModule {
};
exports.StorageModule = StorageModule;
exports.StorageModule = StorageModule = __decorate([
    (0, common_1.Module)({
        providers: [storage_service_1.StorageService],
        exports: [storage_service_1.StorageService],
    })
], StorageModule);


/***/ }),
/* 36 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GrpcModule = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const auth_client_1 = __webpack_require__(30);
const moderation_client_1 = __webpack_require__(18);
let GrpcModule = class GrpcModule {
};
exports.GrpcModule = GrpcModule;
exports.GrpcModule = GrpcModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [auth_client_1.AuthClient, moderation_client_1.ModerationClient],
        exports: [auth_client_1.AuthClient, moderation_client_1.ModerationClient],
    })
], GrpcModule);


/***/ }),
/* 37 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthModule = void 0;
const common_1 = __webpack_require__(2);
const grpc_module_1 = __webpack_require__(36);
const auth_guard_1 = __webpack_require__(29);
const permission_guard_1 = __webpack_require__(31);
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [grpc_module_1.GrpcModule],
        providers: [auth_guard_1.AuthGuard, permission_guard_1.PermissionGuard],
        exports: [auth_guard_1.AuthGuard, permission_guard_1.PermissionGuard],
    })
], AuthModule);


/***/ }),
/* 38 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DatabaseModule = void 0;
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [prisma_service_1.PrismaService],
        exports: [prisma_service_1.PrismaService],
    })
], DatabaseModule);


/***/ }),
/* 39 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CacheModule = void 0;
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(4);
const redis_service_1 = __webpack_require__(22);
let CacheModule = class CacheModule {
};
exports.CacheModule = CacheModule;
exports.CacheModule = CacheModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [redis_service_1.RedisService],
        exports: [redis_service_1.RedisService],
    })
], CacheModule);


/***/ }),
/* 40 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpExceptionFilter = void 0;
const common_1 = __webpack_require__(2);
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(HttpExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const status = exception.getStatus();
        const errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            message: exception.message || 'Internal server error',
        };
        if (status >= common_1.HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(`${request.method} ${request.url}`, exception.stack, 'HttpExceptionFilter');
        }
        else {
            this.logger.warn(`${request.method} ${request.url} - ${status} - ${exception.message}`, 'HttpExceptionFilter');
        }
        response.status(status).json(errorResponse);
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)(common_1.HttpException)
], HttpExceptionFilter);


/***/ }),
/* 41 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LoggingInterceptor_1;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LoggingInterceptor = void 0;
const common_1 = __webpack_require__(2);
const operators_1 = __webpack_require__(42);
let LoggingInterceptor = LoggingInterceptor_1 = class LoggingInterceptor {
    constructor() {
        this.logger = new common_1.Logger(LoggingInterceptor_1.name);
    }
    intercept(context, next) {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const { method, url } = request;
        const now = Date.now();
        return next.handle().pipe((0, operators_1.tap)(() => {
            const delay = Date.now() - now;
            this.logger.log(`${method} ${url} ${response.statusCode} - ${delay}ms`);
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = LoggingInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], LoggingInterceptor);


/***/ }),
/* 42 */
/***/ ((module) => {

module.exports = require("rxjs/operators");

/***/ }),
/* 43 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TransformInterceptor = void 0;
const common_1 = __webpack_require__(2);
const operators_1 = __webpack_require__(42);
let TransformInterceptor = class TransformInterceptor {
    intercept(context, next) {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        return next.handle().pipe((0, operators_1.map)((data) => ({
            data,
            statusCode: response.statusCode,
            message: 'Success',
            timestamp: new Date().toISOString(),
        })));
    }
};
exports.TransformInterceptor = TransformInterceptor;
exports.TransformInterceptor = TransformInterceptor = __decorate([
    (0, common_1.Injectable)()
], TransformInterceptor);


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const core_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(3);
const config_1 = __webpack_require__(4);
const helmet_1 = __webpack_require__(5);
const compression = __webpack_require__(6);
const app_module_1 = __webpack_require__(7);
const http_exception_filter_1 = __webpack_require__(40);
const logging_interceptor_1 = __webpack_require__(41);
const transform_interceptor_1 = __webpack_require__(43);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.use((0, helmet_1.default)());
    app.use(compression());
    app.enableCors({
        origin: configService.get('CORS_ORIGIN', 'http://localhost:3001'),
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor(), new transform_interceptor_1.TransformInterceptor());
    app.setGlobalPrefix('api/v1');
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Media Service API')
        .setDescription('Service de gestion des médias pour Whispr')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('media', 'Gestion des fichiers multimédias')
        .addTag('upload', 'Upload de fichiers')
        .addTag('preview', 'Génération de previews')
        .addTag('quota', 'Gestion des quotas utilisateur')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = configService.get('PORT', 3000);
    await app.listen(port);
    console.log(`Media Service running on port ${port}`);
    console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();

})();

/******/ })()
;