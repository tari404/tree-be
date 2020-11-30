import * as randomString from 'crypto-random-string'

let _pwd = ''

export function setPwd(pwd?: string) {
  _pwd = pwd || randomString({ length: 10 })
  console.log(`set pwd: ${_pwd}`)
}

export function checkPwd(toCheckPwd: string) {
  return _pwd === toCheckPwd
}
