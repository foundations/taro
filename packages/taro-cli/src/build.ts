import * as path from 'path'
import * as fs from 'fs-extra'
import { SyncHook, Hook } from 'tapable'
import * as _ from 'lodash'
import chalk from 'chalk'

import { BUILD_TYPES, PROJECT_CONFIG } from './util/constants'
import { IBuildOptions, IProjectConfig, ICommonPlugin } from './util/types'
import { emptyDirectory } from './util'
import CONFIG from './config'

interface IBuilderHooks {
  beforeBuild: Hook,
  afterBuild: Hook
}

export default class Builder {
  hooks: IBuilderHooks
  appPath: string
  config: IProjectConfig
  constructor (appPath: string) {
    this.hooks = {
      beforeBuild: new SyncHook(['config']),
      afterBuild: new SyncHook(['builder'])
    }

    this.appPath = appPath
    this.init()
  }

  init () {
    this.resolveConfig()
    this.applyPlugins()
  }

  resolveConfig () {
    this.config = require(path.join(this.appPath, PROJECT_CONFIG))(_.merge)
  }

  applyPlugins () {
    const commonConfig = Object.assign({}, { plugins: [] }, this.config.common)
    const plugins = commonConfig.plugins
    if (plugins.length) {
      plugins.forEach((plugin: ICommonPlugin) => {
        plugin.apply(this)
      })
    }
  }

  emptyFirst ({ watch, type }) {
    const outputPath = path.join(this.appPath, `${this.config.outputRoot || CONFIG.OUTPUT_DIR}}`)
    if (!fs.existsSync(outputPath)) {
      fs.ensureDirSync(outputPath)
    } else if (type !== BUILD_TYPES.H5 && (type !== BUILD_TYPES.QUICKAPP || !watch)) {
      emptyDirectory(outputPath)
    }
  }

  build (buildOptions: IBuildOptions) {
    this.hooks.beforeBuild.call(this.config)
    const { type, watch, platform, port } = buildOptions
    this.emptyFirst({ type, watch })
    switch (type) {
      case BUILD_TYPES.H5:
        this.buildForH5(this.appPath, { watch, port })
        break
      case BUILD_TYPES.WEAPP:
      case BUILD_TYPES.SWAN:
      case BUILD_TYPES.ALIPAY:
      case BUILD_TYPES.TT:
      case BUILD_TYPES.QUICKAPP:
      case BUILD_TYPES.QQ:
        this.buildForMini(this.appPath, buildOptions)
        break
      case BUILD_TYPES.RN:
        this.buildForRN(this.appPath, { watch })
        break
      case BUILD_TYPES.UI:
        this.buildForUILibrary(this.appPath, { watch })
        break
      case BUILD_TYPES.PLUGIN:
        this.buildForPlugin(this.appPath, {
          watch,
          platform
        })
        break
      default:
        console.log(chalk.red('输入类型错误，目前只支持 weapp/swan/alipay/tt/h5/quickapp/rn 七端类型'))
    }
  }

  buildForH5 (appPath: string, buildOptions: IBuildOptions) {
    require('./h5').build(appPath, buildOptions)
  }

  buildForMini (appPath: string, buildOptions: IBuildOptions) {
    require('./mini/webpack').build(appPath, buildOptions, this)
  }

  buildForRN (appPath: string, { watch }) {
    require('./rn').build(appPath, { watch })
  }

  buildForUILibrary (appPath: string, { watch }) {
    require('./ui').build(appPath, { watch })
  }

  buildForPlugin (appPath: string, { watch, platform }) {
    const typeMap = {
      [BUILD_TYPES.WEAPP]: '微信',
      [BUILD_TYPES.ALIPAY]: '支付宝'
    }
    if (platform !== BUILD_TYPES.WEAPP && platform !== BUILD_TYPES.ALIPAY) {
      console.log(chalk.red('目前插件编译仅支持 微信/支付宝 小程序！'))
      return
    }
    console.log(chalk.green(`开始编译${typeMap[platform]}小程序插件`))
    require('./plugin').build(appPath, { watch, platform })
  }
}
