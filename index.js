const fetch  = require('node-fetch')
const fs     = require('fs')
const https  = require('https')
const path   = require('path')
const unzip  = require('unzip')
const mkdirp = require('mkdirp')

const buildFileName        = 'build.zip'
const builderUrl           = process.argv[2]
const projectRemote        = process.argv[3]
const projectRevision      = process.argv[4]
const targetLocation       = process.argv[5]
const localConfigFileName  = process.argv[6]

let localConfig = {}


function exitWithError(code, message) {
	console.error('[!]', message)
	process.exit(code)
}


console.log(`Getting the build from a remote builder at '${builderUrl}'`)

if (!builderUrl) {
	exitWithError(7, 'The builder url is missing. Pass it as the first argument.')
}
if (!projectRemote) {
	exitWithError(1, 'The project remote is missing. Pass it as the second argument.')
}
if (!projectRevision) {
	exitWithError(2, 'The project revision is missing. Pass it as the third argument.')
}
if (!targetLocation) {
	exitWithError(5, 'The target location is missing. Pass it as the fourth argument.')
}

if (localConfigFileName) {
	localConfig = JSON.parse(fs.readFileSync(localConfigFileName, 'utf8'))
}

const buildFilePath = path.resolve(targetLocation, buildFileName)


console.log(`\tRemote:   ${projectRemote}`)
console.log(`\tRevision: ${projectRevision}`)
console.log(`\tLocation: ${targetLocation}`)


Promise.resolve()
	.then(() => new Promise((resolve, reject) => {
		mkdirp(targetLocation, (error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	}))
	.then(() =>
		fetch(`${builderUrl}/download`, {
			method: 'post',
			body: JSON.stringify({
				remote: projectRemote,
				revision: projectRevision,
				'mango-cli': '>=0.29',
				dataset: localConfig,
			})
		})
	)
	.then((response) => response.json())
	.then((result) => {
		if (!result.status || result.status === 'error' || !result.url) {
			exitWithError(3, result.message || 'Generic api error without any message')
		}
		return result.url
	})
	.then((url) => {
		console.log(`Downloading the build from '${url}'`)
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(buildFilePath)
			const request = https.get(url, (response) => {
				response.pipe(file)
				file.on('finish', () => {
					file.close(resolve)
				})
			})
				.on('error', (error) => {
					fs.unlink(buildFilePath)
					exitWithError(6, error)
				})
		})
	})
	.then(() => {
		console.log('Extracting')
		return new Promise((resolve, reject) => {
			fs.createReadStream(buildFilePath)
				.on('close', resolve)
				.on('error', (error) => reject(error))
				.pipe(unzip.Extract({
					path: targetLocation,
				}))
		})
	})
	.then(() => {
		fs.unlinkSync(buildFilePath)
	})
	.then(() => console.log(`Revision successfully build and extracted to directory '${targetLocation}'`))
	.catch((error) => {
		exitWithError(4, error)
	})
