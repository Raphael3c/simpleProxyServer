var net = require("net")
var fs = require('fs')

// Cria o servidor proxy na porta 8888
var proxy = net.createServer().listen(8888)

// Obtém o tempo digitado na linha de comando.
var COMMAND_LINE_ARGUMENT = process.argv[2]

// Verifica se o tempo digitado é válido, caso não seja, seta 120 segundos por padrão.
if(!isCorrect(COMMAND_LINE_ARGUMENT)){
  console.log(`The value passed in the commandline is invalid: ${COMMAND_LINE_ARGUMENT}. We have set the expire time to 120 seconds.`)
  COMMAND_LINE_ARGUMENT = 120
}

function handleRequisitionBrowser(dataFromBrowser){
  /*
    handleRequisitionBrowser(Data) -> {String, String, String, String} 
  
    Manipula os dados recebidos do navegador armazenando em váriáveis úteis 
    para uso futuro na aplicação. 
  */

  const [firstLine, ...otherLines] = dataFromBrowser.toString().split('\n');
        
        // Obtém da primeira linha o method, path e httpVersion.
        const [method, path, httpVersion] = firstLine.trim().split(' ');
        
        // Obtém de otherLines os headers. 
        const headers = Object.fromEntries(otherLines.filter(_=>_)
            .map(line=>line.split(':').map(part=>part.trim()))
            .map(([name, ...rest]) => [name, rest.join(' ')]));

       // Retorna os dados manipulados amazenados em variáveis.
       return {
            method,
            path,
            httpVersion,
            headers,
        }
}

function isCorrect(COMMAND_LINE_ARGUMENT){
  /*
    isCorrect(COMMAND_LINE_ARGUMENT) -> Boolean

    Essa função faz o tratamento do argumento que for digitado na linha de comando, 
    garantindo que seja um valor inteiro e que seja maior que zero, retornando true quando tudo OK. 
  */
  
  let regExp = /[^0-9]/g;   
  if(regExp.test(COMMAND_LINE_ARGUMENT) || 
  COMMAND_LINE_ARGUMENT == undefined || 
  COMMAND_LINE_ARGUMENT == 0 || 
  COMMAND_LINE_ARGUMENT > 120){
    return false
  }

  return true
}

function handlePath(path){
  /* 
    handlePath(String) -> {String, String}

    Manipula o caminho recebido, obtendo e retornando o Caminho Absoluto e o Domínio.
  */  

  let [ , ...otherPaths] = path.split("/")
  let [domain, ...pathToFileArray] = otherPaths;
  const pathToFile = pathToFileArray.toString().trim().replace(',','/')
   
  return {pathToFile, domain}
}

function isExpired(dataFromCache){
  /*
    isExpired(Data) -> Boolean

    Verifica se os dados guardados em Cache estão expirados, 
    caso estreja expirado retorna true, caso contrário false.
  */

  let {headers}  = handleRequisitionBrowser(dataFromCache)
  let [, , , , hours, minutes, ] = headers.Date.split(" ")

  let dateNow = new Date()

  const utcHour = dateNow.getUTCHours()
  const utcMinutes = dateNow.getUTCMinutes()

  let newDateNow = new Date(0, 0, 0, utcHour, utcMinutes, 0)
  let datePast = new Date(0, 0, 0, hours, minutes, 0)       
  
  let timePassed = newDateNow.getTime() - datePast.getTime();
  let hoursPassed = Math.floor(timePassed / 1000 / 60 / 60);
  timePassed -= hoursPassed * 1000 * 60 * 60;
  let secondsPassed = Math.floor(timePassed / 1000 / 60) * 60;

  COMMAND_LINE_ARGUMENT = Number(COMMAND_LINE_ARGUMENT)
  
  if(secondsPassed >= COMMAND_LINE_ARGUMENT){
    return true
  }

  return false
}

function getLocalDate(){
  /*
    getLocalDate(null) -> Date

    Obtém a data atual, manipula e armazena em variáveis.
  */

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
  /*
    injectHTML(Data) -> {Bytes, Bytes}

    Sugestão de mudança: (POR RAPHAEL) 
    injectHTML(Bytes) -> {Bytes, Bytes}, o que nós recebemos e retornamos é um array de bytes.
    No entanto, não sei exatamente como expor esse tipo de dado nessa descrição. Descobre ae :)

    Essa função manipula o cabeçalho e injeta o html do post-it na página requisitada. 
  */

  console.log(typeof(dataExternalServer))
  let stringData = String(dataExternalServer)
  let stringDataCopy = String(dataExternalServer)

  let requisitionNew
  let requisitionCache

  // Caso o arquivo não seja um HTML.
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

  requisitionNew = Buffer.from(requisitionNew)
  requisitionCache = Buffer.from(requisitionCache)

  return {
    requisitionNew,
    requisitionCache
  }
}

function concatenateAll(body, indexTagClosedBody, stringData, htmlToInject){
  /*
    concatenateAll(String, String, String, String) -> String

    Essa função apenas concatena todos os splits feitos até aqui.
  */

  let bodyAux = ''
  let requisicao = ''

  // Caso não haja </body>
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

function getPageAndStore(domain, pathToFile, socketProxy){
  /*
    getPageAndStore(String, String, Socket) -> String

    Obtém a página requisitada.
  */

  console.log(`Searching for ${domain}/${pathToFile}  ... \n`)
  
  const STANDART_PORT = 80

  var client = net.createConnection(STANDART_PORT, domain)

  client.on("connect", () => {

    console.log(`Client(port: ${client.localPort}) connected with ${domain}(${client.remoteAddress})\nReq: GET /${pathToFile}\n`)

    let requisition = `GET /${pathToFile} HTTP/1.1\r\nHost: ${domain}\r\n\r\n`

    requisition = Buffer.from(requisition)

    client.write(requisition)
  })

  client.on("data", (dataExternalServer) => {
    const path = pathToFile.replace('/','%')
    const nameInCache = `${domain}%${path}`
    
    let {requisitionNew, requisitionCache} = injectHTML(dataExternalServer)

    fs.appendFile(`./${nameInCache}`, requisitionCache, (err) => {
      if(err){
        console.log(err)
        return
      }
    })   

    socketProxy.write(requisitionNew)
  })

  client.on("end", () => {
    console.log(`The connection with ${domain}(${client.remoteAddress}) has closed\n`)
  })

  client.on("error", (err) => {
    if(err){
      console.log(err)
      return
    }
  })
}

// Fluxo principal
proxy.on("connection", (socketProxy) => {
  socketProxy.on('data', (dataFromBrowser) => {
    
    let {method, path, headers} = handleRequisitionBrowser(dataFromBrowser)
    let {pathToFile, domain} = handlePath(path)

    if(domain == ''){
      console.log("URL invalid")
      socketProxy.end()
      return
    }

    if(method != "GET"){
      console.log(`Método ${method} inválido.`)
      socketProxy.end()
      return
    }

    // Verifica se há o campo Referer no cabeçalho. 
    // Se houver, o domínio será pego através desse campo.
    if(headers.Referer){
      domain = headers.Referer.split("/")[3]
    }

    // Nomeação do arquivo em cache.
    pathToFile = pathToFile.replace('/','%')

    const nameInCache = `${domain}%${pathToFile}`

    fs.readFile(`./${nameInCache}`, (isNotFile, dataFromCache) => {
      
      // Se não existe, busca a página e armazena em cache.
      if(isNotFile){
        getPageAndStore(domain, pathToFile, socketProxy)
        return
      }

      // Se existe e está expirado,  busca a página e armazena em cache.
      if(isExpired(dataFromCache)){
        const path = pathToFile.replace('/','%')
        const nameInCache = `${domain}%${path}`

        fs.rm(`./${nameInCache}`, () => {
          console.log(`${nameInCache} was removed from cache. Time expired.\n`)
        })

        getPageAndStore(domain, pathToFile, socketProxy)
        return
      }     

      // Se existe no cache e não está expirado, envia o arquivo ao browser 
      console.log(`${domain}/${pathToFile} already in cache\n`)
      socketProxy.write(dataFromCache)
      socketProxy.end()
      return
    })
  })

  proxy.on("end", () => {
    console.log("Proxy terminated\n")
  })

  proxy.on("error", (err) => {
    if(err){
      console.log(err)
      return
    }
  })
})