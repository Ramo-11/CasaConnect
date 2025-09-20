const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../logger');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Don't call getPublicUrl here
exports.uploadFile = async (file, folder = 'documents') => {
    try {
        const fileName = `${folder}/${Date.now()}-${file.originalname}`;
        const { error } = await supabase.storage.from('casaconnect').upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
        });

        if (error) throw error;

        return {
            fileName,
            size: file.size,
            mimeType: file.mimetype,
        };
    } catch (error) {
        logger.error(`File upload error: ${error}`);
        throw error;
    }
};

exports.deleteFile = async (fileName) => {
    try {
        const { error } = await supabase.storage.from('casaconnect').remove([fileName]);

        if (error) throw error;
        return true;
    } catch (error) {
        logger.error(`File delete error: ${error}`);
        throw error;
    }
};

// Upload service request photos
exports.uploadServicePhoto = async (file, requestId) => {
    try {
        const fileName = `service-requests/${requestId}/${Date.now()}-${file.originalname}`;
        const { error } = await supabase.storage
            .from('service-photos')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
            });

        if (error) throw error;

        // Get public URL for the photo
        const {
            data: { publicUrl },
        } = supabase.storage.from('service-photos').getPublicUrl(fileName);

        return {
            url: publicUrl,
            fileName,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
        };
    } catch (error) {
        logger.error(`Service photo upload error: ${error}`);
        throw error;
    }
};

// Delete service photos
exports.deleteServicePhotos = async (fileNames) => {
    try {
        const { error } = await supabase.storage.from('service-photos').remove(fileNames);

        if (error) throw error;
        return true;
    } catch (error) {
        logger.error(`Service photos delete error: ${error}`);
        throw error;
    }
};

exports.getSignedUrl = async (fileName, expiresIn = 3600, opts = {}) => {
    try {
        const { data, error } = await supabase.storage
            .from('casaconnect')
            .createSignedUrl(fileName, expiresIn, {
                download: opts.download || undefined,
            });
        if (error) throw error;
        return data.signedUrl;
    } catch (error) {
        logger.error(`Get signed URL error: ${error}`);
        throw error;
    }
};

exports.getServicePhotoSignedUrl = async (fileName, expiresIn = 3600, opts = {}) => {
    try {
        const { data, error } = await supabase.storage
            .from('service-photos')
            .createSignedUrl(fileName, expiresIn, {
                download: opts.download || undefined,
            });
        if (error) throw error;
        return data.signedUrl;
    } catch (error) {
        logger.error(`Service photo signed URL error: ${error}`);
        throw error;
    }
};

exports.handleMulterError = (err, req, res, next) => {
    const multer = require('multer');

    try {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res
                    .status(400)
                    .json({ success: false, error: 'Each photo must be under 5MB.' });
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ success: false, error: 'Too many files uploaded.' });
            }

            return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        }

        next(err);
    } catch (error) {
        logger.error(`Multer error handling failed: ${error}`);
        res.status(500).json({ success: false, error: 'File upload failed unexpectedly.' });
    }
};
