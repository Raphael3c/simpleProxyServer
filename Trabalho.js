var net = require("net")
var fs = require('fs')

var proxy = net.createServer().listen(8888)

function handleReq(dataFromBrowser){
  const [firstLine, ...otherLines] = dataFromBrowser.toString().split('\n');
        const [method, path, httpVersion] = firstLine.trim().split(' ');
        const headers = Object.fromEntries(otherLines.filter(_=>_)
            .map(line=>line.split(':').map(part=>part.trim()))
            .map(([name, ...rest]) => [name, rest.join(' ')]));

       return {
            method,
            path,
            httpVersion,
            headers,
        }
}

function handlePath(path){
    let [ , ...otherPaths] = path.split("/")
    let [domain, ...absolutePathArray] = otherPaths;
    const absolutePath = absolutePathArray.toString().trim().replace(',','/')
   
    return {absolutePath, domain}
}

function isExpired(dataFromCache){
  let {headers}  = handleReq(dataFromCache)
  let [, , , , hours, minutes, ] = headers.Date.split(" ")

  let dateNow = new Date()

  let newDateNow = new Date(0, 0, 0, dateNow.getUTCHours(), dateNow.getUTCMinutes(), 0)
  let datePast = new Date(0, 0, 0, hours, minutes, 0)       
  
  let timePassed = newDateNow.getTime() - datePast.getTime();
  let hoursPassed = Math.floor(timePassed / 1000 / 60 / 60);
  timePassed -= hoursPassed * 1000 * 60 * 60;
  let secondsPassed = Math.floor(timePassed / 1000 / 60) * 60;

  let commandLineArgument = process.argv[2]
  commandLineArgument = Number(commandLineArgument)
  if(secondsPassed >= commandLineArgument){
    return true
  }

  return false
}

function getLocalDate(){
  var localDate = new Date();

  var dayMonth = localDate.getDate(); // 1-31
  var month = localDate.getMonth() + 1; // 0-11 (zero=janeiro)
  var year = localDate.getFullYear();
  var hour = localDate.getHours();
  var min = localDate.getMinutes();
  var sec = localDate.getSeconds();

  return {
    dayMonth, 
    month,
    year,
    hour,
    min,
    sec
  }
}

function injectHTML(dataExternalServer){

  let stringData = String(dataExternalServer)
  let stringDataCopy = String(dataExternalServer)

  let requisitionNew
  let requisitionCache

  //Caso o arquivo não seja um HTML.
  if(!stringData.includes('html')){
    requisitionNew = dataExternalServer
    requisitionCache = dataExternalServer
    return {
      requisitionNew,
      requisitionCache
    }
  }

  let {dayMonth, month, year, hour, min, sec} = getLocalDate()

  let htmlToInjectNew = `\n<p style="z-index:9999; position:fixed; top:20px; left:20px;width:200px;height:100px; background-color:yellow;padding:10px; font-weight:bold;">Nova em: ${year}-${month}-${dayMonth} ${hour}:${min}:${sec}</p>`
  let htmlToInjectCache = `\n<p style="z-index:9999; position:fixed; top:20px; left:20px;width:200px;height:100px; background-color:yellow;padding:10px; font-weight:bold;">Cache: ${year}-${month}-${dayMonth} ${hour}:${min}:${sec}</p>`

  stringData = stringData.split("\r\n")
  stringDataCopy = stringDataCopy.split("\r\n")

  let body = stringData[stringData.length-1]
  let bodyCopy = stringDataCopy[stringDataCopy.length-1]

  stringData[stringData.length-1] = ''
  stringDataCopy[stringDataCopy.length-1] = ''
  
  for(index in stringData){
    if(stringData[index].includes("Content-Length")){
      let contentLength = ''
      let contentLengthCopy = ''

      for(i=16; i < stringData[index].length; i++){
        contentLength += stringData[index][i]
        contentLengthCopy += stringDataCopy[index][i]
      }

      let intContentLength = parseInt(contentLength);
      intContentLength = intContentLength + htmlToInjectNew.length
      let stringNewContentLength = intContentLength.toString()

      let intContentLengthCopy = parseInt(contentLengthCopy);
      intContentLengthCopy = intContentLengthCopy + htmlToInjectCache.length
      let stringNewContentLengthCopy = intContentLengthCopy.toString()

      stringData[index] = stringData[index].replace(contentLength, stringNewContentLength)
      stringDataCopy[index] = stringDataCopy[index].replace(contentLengthCopy, stringNewContentLengthCopy)
      break
    }
  }

  body = body.split("\n")
  bodyCopy = bodyCopy.split("\n")

  let indexTagClosedBody = body.indexOf('</body>')
  let indexTagClosedBodyCopy = bodyCopy.indexOf('</body>')
  
  requisitionNew = concatenateAll(body, indexTagClosedBody, stringData, htmlToInjectNew)
  requisitionCache = concatenateAll(bodyCopy, indexTagClosedBodyCopy, stringDataCopy, htmlToInjectCache)

  return {
    requisitionNew,
    requisitionCache
  }
}

function concatenateAll(body, indexTagClosedBody, stringData, htmlToInject){
  //A função apenas concatena todos os splits feitos até aqui.

  let bodyAux = ''
  let requisicao = ''

  //Caso não aja </body>
  if(indexTagClosedBody != -1){
    body[indexTagClosedBody-1] += htmlToInject
  
    for(index in body){
      bodyAux += `${body[index]}\n` 
    }
  
    stringData[stringData.length-1] = bodyAux;
  
    for(index in stringData){
      requisicao += `${stringData[index]}\r\n`
    }

    return requisicao
  }

  for(index in body){
    bodyAux += `${body[index]}\n` 
  }

  stringData[stringData.length-1] = bodyAux;

  for(index in stringData){
    requisicao += `${stringData[index]}\r\n`
  }

  return requisicao
}

function getPage(domain, absolutePath, socketProxy){

  console.log(`Searching for ${domain}/${absolutePath}  ... \n`)
  
  var client = net.createConnection(80, domain)

  client.on("connect", () => {

    console.log(`Client(port: ${client.localPort}) connected with ${domain}(${client.remoteAddress})\nReq: GET /${absolutePath}\n`)

    let requisition = `GET /${absolutePath} HTTP/1.1\r\nHost: ${domain}\r\n\r\n`

    requisition = Buffer.from(requisition)

    client.write(requisition)

  })

  client.on("data", (dataExternalServer) => {
    const path = absolutePath.replace('/','%')
    const nameInCache = `${domain}%${path}`
    
    let {requisitionNew, requisitionCache} = injectHTML(dataExternalServer)

    fs.appendFile(`./${nameInCache}`, requisitionCache, (err) => {})   

    socketProxy.write(requisitionNew)
  })

  client.on("end", () => {
    console.log(`The connection with ${domain}(${client.remoteAddress}) has closed\n`)
  })

  client.on("error", (err) => {
    console.log("Client Error")
  })
}

// Fluxo principal

proxy.on("connection", (socketProxy) => {
  socketProxy.on('data', (dataFromBrowser) => {
    
    //let {method, path, httpVersion, headers} = handleReq(dataFromBrowser)
    let {method, path, headers} = handleReq(dataFromBrowser)
    let {absolutePath, domain} = handlePath(path)

    if(method != "GET"){
      console.log(`Método ${method} inválido.`)
      return
    }

    //Verifica se há o campo Referer no cabeçalho. 
    //Se houver, o domínio será pego através desse campo.
    if(headers.Referer){
      domain = headers.Referer.split("/")[3]
    }

    //Nomeação do arquivo em cache.
    path = absolutePath.replace('/','%')

    const nameInCache = `${domain}%${path}`

    fs.readFile(`./${nameInCache}`, (isNotFile, dataFromCache) => {
      
      //Se não existe, busca a página.
      if(isNotFile){
        getPage(domain, absolutePath, socketProxy)
        return
      }

      //Se está expirado, busca a página.
      if(isExpired(dataFromCache)){
        const path = absolutePath.replace('/','%')
        const url = `${domain}%${path}`

        fs.rm(`./${url}`, () => {
          console.log(`${url} was removed from cache. Time expired.\n`)
        })

        getPage(domain, absolutePath, socketProxy)
        return
      }     

      console.log(`${domain}/${absolutePath} already in cache\n`)
      socketProxy.write(dataFromCache)
      socketProxy.end()
      return
    })
  })

  proxy.on("end", () => {
    console.log("Proxy terminated\n")
  })

  proxy.on("error", (err) => {
  })
})