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
      var minutesTeste = Math.floor(diff / 1000 / 60);

      if(minutesTeste > 2){
        return true
      }

      return false
    
}

function injectHTML(data){
  const htmlCache = '<p style="z-index:9999; position:fixed; top:20px; left:20px; width:200px; height:100px; background-color:yellow; padding:10px; font-weight:bold;">O de Cache</p>' 
  const htmlNovo = '<p style="z-index:9999; position:fixed; top:20px; left:20px; width:200px; height:100px; background-color:yellow; padding:10px; font-weight:bold;">O novo</p>'
  
  let teste = data.toString().split('\n')

  let testeNovo = data.toString().split('\n')

  let index = teste.indexOf('</body>')    
  let indexNovo = testeNovo.indexOf('</body>')

  teste[index-1] += `\n${htmlCache}`
  testeNovo[indexNovo-1] += `\n${htmlNovo}`
  var testeAA = ''
  var testeBB = ''
  for(indexTeste in teste){
    if(teste[indexTeste].includes("Content-Length")) continue;
    teste[indexTeste] += "\n"
    testeAA += teste[indexTeste]
  }
  
  console.log(testeAA)
  return testeAA;
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

    await fs.readFile(`./${quote1}`, async (isNotFile, data) => {
      //Se o não arquivo existir ele entre no if e busca a página.Se não, ele apenas pega o que está em cache e joga de volta.
      
      if(isNotFile){
        //Função que pede a pagina ao servidor e armazena em cache.
        getPage(domain, absolutePath, proxy)
        return
      }

      if(isExpired(data)){
        const path = absolutePath.replace('/','%')
        const quote = `${domain}%${path}`
        await fs.rm(`./${quote}`, () => {
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

async function getPage(domain, absolutePath, proxy){
  console.log(`O site ${domain}/${absolutePath} não estava em cache`)
  var client = net.createConnection(80, domain)

      client.on("connect", () => {
        console.log(`Client(port: ${client.localPort}) connected with ${domain}(${client.remoteAddress})\nReq: GET /${absolutePath}\n`)
        let buffer = Buffer.from((`GET /${absolutePath} HTTP/1.1\r\nHost: ${domain}\r\n\r\n`))
        client.write(buffer)
      })

      client.on("data", (data) => {
        const path = absolutePath.replace('/','%')
        const quote = `${domain}%${path}`

        var dataModified = injectHTML(data);

        fs.appendFile(`./${quote}`, dataModified, (err) => {
          if(err) throw err
        })

        proxy.write(dataModified)
        proxy.end()
      })

      client.on("end", () => {
        console.log(`Server ${domain}(${client.remoteAddress}) shutdown the connection\n`)
      })

      client.on("error", (err) => {
        console.log("Client Error")
      })
}