var net = require("net")
var fs = require('fs')
//PRECISO FAZER COM QUE O MEU PROGRAMA ACEITE PARÂMETROS MANDADOS ATRAVÉS DA LINHA DE COMANDO:
//VER:
//https://www.ti-enxame.com/pt/javascript/como-faco-para-passar-argumentos-de-linha-de-comando-para-um-programa-node.js/970510029/
var server = net.createServer().listen(8888)

function handleReq(data){
  const [firstLine, ...otherLines] = data.toString().split('\n');
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
    let [b, ...otherPaths] = path.split("/")
    let [domain, ...absolutePathArray] = otherPaths;
    const absolutePath = absolutePathArray.toString().trim().replace(',','/')
   /*  if(headersReferer != undefined){
      domain = headersReferer.split("/")[3]
    } */

    return {absolutePath, domain}
}

function isExpired(data){
  let { headers, ...teste}  = handleReq(data)
  let [weekDay, dayMonth, month, year, hours, minutes, seconds] = headers.Date.split(" ")

  let date = new Date()

  let newDateNow = new Date(0, 0, 0, date.getUTCHours(), date.getUTCMinutes(), 0)
  let datePast = new Date(0, 0, 0, hours, minutes, 0)       
  var diff = newDateNow.getTime() - datePast.getTime();
  var hoursTeste = Math.floor(diff / 1000 / 60 / 60);
  diff -= hoursTeste * 1000 * 60 * 60;
  var secondsBetween = Math.floor(diff / 1000 / 60) * 60;

  if(secondsBetween >= process.argv[2]){
    return true
  }

  return false
}

function injectHTMLNova(data){

  let stringData = String(data)

  if(!stringData.includes('html')){
    return data
  }

  stringData = stringData.split("\r\n")

  let body = stringData[stringData.length-1]

  stringData[stringData.length-1] = ''
  
  for(index in stringData){
    if(stringData[index].includes("Content-Length")){
      controle = 1
      let contentLength = ''
      for(i=16; i < stringData[index].length; i++){
        contentLength += stringData[index][i]
      }
      let intContentLenght = parseInt(contentLength);
      intContentLenght = intContentLenght + 177
      intContentLenght = intContentLenght.toString()

      stringData[index] = stringData[index].replace(contentLength, intContentLenght)
      break
    }
  }
  body = body.split("\n")
  let indexTagClosedBody = body.indexOf('</body>')

  var dataDoPC = new Date();
  // Guarda cada pedaço em uma variável
  var dia     = dataDoPC.getDate();           // 1-31
  var mes     = dataDoPC.getMonth() + 1;          // 0-11 (zero=janeiro)
  var ano4    = dataDoPC.getFullYear();       // 4 dígitos
  var hora    = dataDoPC.getHours();          // 0-23
  var min     = dataDoPC.getMinutes();        // 0-59 
  var seg     = dataDoPC.getSeconds();        // 0-59

  let htmlToInject = `\n<p style="z-index:9999; position:fixed; top:20px; left:20px;width:200px;height:100px; background-color:yellow;padding:10px; font-weight:bold;">Nova em: ${ano4}-${mes}-${dia} ${hora}:${min}:${seg}</p>`

  let requisicaoNova = realInjectHTML(body, indexTagClosedBody, stringData, htmlToInject)

  return requisicaoNova
}

function injectHTMLCache(data){

  let stringData = String(data)

  if(!stringData.includes('html')){
    return data
  }

  stringData = stringData.split("\r\n")

  let body = stringData[stringData.length-1]

  stringData[stringData.length-1] = ''
  
  for(index in stringData){
    if(stringData[index].includes("Content-Length")){
      controle = 1
      let contentLength = ''
      for(i=16; i < stringData[index].length; i++){
        contentLength += stringData[index][i]
      }
      let intContentLenght = parseInt(contentLength);
      intContentLenght = intContentLenght + 175
      intContentLenght = intContentLenght.toString()

      stringData[index] = stringData[index].replace(contentLength, intContentLenght)
      break
    }
  }
  body = body.split("\n")
  let indexTagClosedBody = body.indexOf('</body>')
  var dataDoPC = new Date();
  // Guarda cada pedaço em uma variável
  var dia     = dataDoPC.getDate();           // 1-31
  var mes     = dataDoPC.getMonth() + 1;          // 0-11 (zero=janeiro)
  var ano4    = dataDoPC.getFullYear();       // 4 dígitos
  var hora    = dataDoPC.getHours();          // 0-23
  var min     = dataDoPC.getMinutes();        // 0-59 
  var seg     = dataDoPC.getSeconds();        // 0-59

  let htmlToInject2 = `\n<p style="z-index:9999; position:fixed; top:20px; left:20px;width:200px;height:100px; background-color:yellow;padding:10px; font-weight:bold;">Cache: ${ano4}-${mes}-${dia} ${hora}:${min}:${seg}</p>`

  let requisicaoCache = realInjectHTML(body, indexTagClosedBody, stringData, htmlToInject2)

  return requisicaoCache
}

function realInjectHTML(body, indexTagClosedBody, stringData, htmlToInject){
  let bodyAux = ''
  let requisicao = ''

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

server.on("connection", (proxy) => {
  proxy.on('data', async (data) => {
    let {method, path, httpVersion, headers} = handleReq(data)
    let {absolutePath, domain} = handlePath(path)

    if(headers.Referer){
      domain = headers.Referer.split("/")[3]
    }

    path = absolutePath.replace('/','%')

    const quote1 = `${domain}%${path}`

    fs.readFile(`./${quote1}`, (isNotFile, data) => {
      //Se o arquivo não existir ele entra no if e busca a página. Se não, ele apenas pega o que está em cache e joga de volta.
      
      if(isNotFile){
        //Função que pede a pagina ao servidor e armazena em cache.
        getPage(domain, absolutePath, proxy)
        return
      }

      if(isExpired(data)){
        const path = absolutePath.replace('/','%')
        const quote = `${domain}%${path}`
        fs.rm(`./${quote}`, () => {
          console.log(`${quote} removido do cache. Estrapolou o limite`)
        })
        getPage(domain, absolutePath, proxy)
        return
      }     

      console.log(`O site ${domain}/${absolutePath} estava em cache`)
      proxy.write(data)
      proxy.end()
      return
    })
  })

  proxy.on("end", () => {
    console.log("Proxy terminated\n")
  })

  proxy.on("error", (err) => {
  })
})

function getPage(domain, absolutePath, proxy){
  console.log(`O site ${domain}/${absolutePath} não estava em cache`)
  var client = net.createConnection(80, domain)

      client.on("connect", () => {
        console.log(`Client(port: ${client.localPort}) connected with ${domain}(${client.remoteAddress})\nReq: GET /${absolutePath}\n`)
        let buffer = Buffer.from((`GET /${absolutePath} HTTP/1.1\r\nHost: ${domain}\r\n\r\n`))
        client.write(buffer)
      })

      client.on("data", async (data) => {
        const path = absolutePath.replace('/','%')
        const quote = `${domain}%${path}`
        
        let requisicaoNova = injectHTMLNova(data)
        let requisicaoCache = injectHTMLCache(data)

        fs.appendFile(`./${quote}`, requisicaoCache, (err) => {
          if(err) throw err
        })   

        proxy.write(requisicaoNova)
      })

      client.on("end", () => {
        console.log(`Server ${domain}(${client.remoteAddress}) shutdown the connection\n`)
      })

      client.on("error", (err) => {
        console.log("Client Error")
      })
}