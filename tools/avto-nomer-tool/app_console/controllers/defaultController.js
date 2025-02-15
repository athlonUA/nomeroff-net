const config = require('config'),
      fs = require('fs'),
      path = require('path'),
      jsonStore = require('../../app/helpers/jsonStore'),
      checkDir = require('../../app/helpers/checkDir'),
      checkDirStructure = require('../../app/helpers/checkDirStructure'),
      moveDatasetFiles = require('../../app/helpers/moveDatasetFiles'),
      arrayShuffle = require('../../app/helpers/arrayShuffle'),
      sizeOf = require('image-size')
;

/**
 * @module controllers/defaultController
 */
async function index (options) {
        console.log('Hello world defaultController & index action with options: ' +JSON.stringify(options));
};


/**
 * Создание OCR-датасета Nomeroff Net
 *
 * @param options
 * @example ./console.js --action=createAnnotations  --baseDir=../../dataset/ocr/kz/kz2
 */
async function createAnnotations (options) {
        let baseDir = options.baseDir || config.dataset.baseDir;
        checkDir(baseDir);

        const imgPath = path.join(baseDir, config.dataset.img.dir),
              annPath = path.join(baseDir, config.dataset.ann.dir),
              imgExt = '.'+config.dataset.img.ext,
              tplPath = path.join(config.template.path, config.template.annDefault),
              annTrmplate = require(tplPath);
        checkDir(imgPath);
        checkDir(annPath,true);

        console.log(imgPath);
        fs.readdir(imgPath, async function(err, items) {
                for (let i=0; i<items.length; i++) {
                        const  filename = items[i],
                               fileObj = path.parse(filename);
                        if (fileObj.ext == imgExt) {
                                const annFile = path.join(annPath, `${fileObj.name}.${config.dataset.ann.ext}`),
                                      imgFile = path.join(imgPath, filename),
                                      imgSize = sizeOf(imgFile);
                                let data = Object.assign(annTrmplate,{
                                        description: fileObj.name,
                                        name: fileObj.name,
                                        size: {
                                                width: imgSize.width,
                                                height: imgSize.height
                                        }
                                });
                                console.log(`Store ${annFile}`);
                                await jsonStore(annFile, data);
                                // if (data.description.length > 8) {
                                //         console.log(`File: ${filename} [${data.description}]`);
                                // }
                        }
                }
        });
};

/**
 * Перенести в одельную папку из OCR-датасета промодеированные данные
 *
 * @param options
 * @example ./console.js --section=default --action=moveChecked  --opt.srcDir=../../datasets/ocr/kz/draft --opt.targetDir=../../datasets/ocr/kz/checked
 */
async function moveChecked (options) {
        const srcDir = options.srcDir || './draft',
              targetDir = options.targetDir || './checked',
              annExt = '.'+config.dataset.ann.ext,
              src = { annPath: path.join(srcDir, config.dataset.ann.dir) },
              target = { annPath: path.join(targetDir, config.dataset.ann.dir) }
        ;
        let checkedAnn = [],
            checkedImg = []
        ;
        checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
        checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

        fs.readdir(src.annPath, async function(err, items) {
                for (var i=0; i<items.length; i++) {
                        const  filename = items[i],
                            fileObj = path.parse(filename);
                        //console.log(fileObj)
                        if (fileObj.ext == annExt) {
                                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                                      annFilename = path.join( src.annPath, annName);
                                const data = require(path.isAbsolute(annFilename)?annFilename:path.join(process.cwd(), annFilename)),
                                      imgName = `${data.name}.${config.dataset.img.ext}`
                                ;
                                if (data.moderation != undefined && data.moderation.isModerated != undefined && data.moderation.isModerated) {
                                        checkedAnn.push(annName);
                                        checkedImg.push(imgName);
                                }
                        }
                }
                console.log(`Checked: ${checkedAnn.length}`);
                moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:false});
        });
}

/**
 * Поделить датасет на 2 части в заданой пропорции
 *
 * @param options
 * @example ./console.js --section=default --action=dataSplit --opt.splitRate=0.2  --opt.srcDir=../../datasets/ocr/draft --opt.targetDir=../../datasets/ocr/test
 *          use opt.test=1 if you want emulate split process
 */
async function dataSplit (options) {
        const srcDir = options.srcDir || './train',
            targetDir = options.targetDir || './val',
            splitRate = options.rate || 0.2,
            testMode = options.test || false,
            annExt = '.'+config.dataset.ann.ext,
            src = { annPath: path.join(srcDir, config.dataset.ann.dir) },
            target = { annPath: path.join(targetDir, config.dataset.ann.dir) }
        ;
        let checkedAnn = [],
            checkedImg = []
        ;

        checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
        checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

        fs.readdir(src.annPath, async function(err, items) {
                let sItems = arrayShuffle(items),
                    cnt = Math.round(sItems.length * splitRate),
                    itemsTest = sItems.slice(0,cnt);

                for (var i=0; i<itemsTest.length; i++) {
                        const  filename = items[i],
                               fileObj = path.parse(filename);
                        //console.log(fileObj)
                        if (fileObj.ext == annExt) {
                                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                                    annFilename = path.join( src.annPath, annName);
                                const data = require(path.isAbsolute(annFilename)?annFilename:path.join(process.cwd(), annFilename)),
                                    imgName = `${data.name}.${config.dataset.img.ext}`
                                ;
                                checkedAnn.push(annName);
                                checkedImg.push(imgName);
                        }
                }
                moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:testMode});
                console.log(`All records: ${items.length}`);
                console.log(`Moved records: ${itemsTest.length}`);
        });
}


/**
 * Перенести в одельную папку "мусор" ("region_id": 0) из OCR-датасета
 *
 * @param options
 * @example ./console.js --section=default --action=moveGarbage  --opt.srcDir=../../datasets/ocr/kz/draft --opt.targetDir=../../datasets/ocr/kz/garbage
 */
async function moveGarbage (options) {
    const srcDir = options.srcDir || './draft',
        targetDir = options.targetDir || './checked',
        annExt = '.'+config.dataset.ann.ext,
        src = { annPath: path.join(srcDir, config.dataset.ann.dir) },
        target = { annPath: path.join(targetDir, config.dataset.ann.dir) }
    ;
    let checkedAnn = [],
        checkedImg = []
    ;
    checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
    checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

    fs.readdir(src.annPath, async function(err, items) {
        for (var i=0; i<items.length; i++) {
            const  filename = items[i],
                fileObj = path.parse(filename);
            //console.log(fileObj)
            if (fileObj.ext == annExt) {
                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                    annFilename = path.join( src.annPath, annName);
                const data = require(path.isAbsolute(annFilename)?annFilename:path.join(process.cwd(), annFilename)),
                    imgName = `${data.name}.${config.dataset.img.ext}`
                ;
                if (data.region_id != undefined && data.region_id == 0) {
                    checkedAnn.push(annName);
                    checkedImg.push(imgName);
                }
            }
        }
        console.log(`Garbage: ${checkedAnn.length}`);
        moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:false});
    });
}

module.exports = {index, createAnnotations, moveChecked, dataSplit, moveGarbage};


