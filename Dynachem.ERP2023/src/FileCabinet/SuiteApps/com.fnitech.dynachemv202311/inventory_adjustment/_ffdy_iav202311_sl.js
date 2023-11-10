/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget','N/record','N/url','N/file','N/query','N/render','N/runtime'],
    /**
     * @param{serverWidget} serverWidget
     * @param{record} record
     * @param{url} url
     * @param{file} file
     * @param{query} query
     * @param{render} render
     * @param{runtime} runtime
     */
    (serverWidget,record,url,file,query,render,runtime) => {
        //PDF字體
        let REGULAR_LINK = "https://$domain/c.$accountId/suiteapp/com.fnitech.dynachemv202311/FniUtil/Fonts/NotoSansSC-Regular.ttf"
        let BOLD_LINK = "https://$domain/c.$accountId/suiteapp/com.fnitech.dynachemv202311/FniUtil/Fonts/NotoSansSC-Bold.ttf"
        let LIGHT_LINK="https://$domain/c.$accountId/suiteapp/com.fnitech.dynachemv202311/FniUtil/Fonts/NotoSansSC-Light.ttf"

        const FILENAME = 'pdf_col_translation.json'
        let COLSPAN_ALL = 30

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} context
         * @param {ServerRequest} context.request - Incoming request

         * @param {ServerResponse} context.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (context) => {
            if (context.request.method === 'GET') {
                let recordId = context.request.parameters.recordId
                let objRecord = record.load({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    id: recordId,
                    isDynamic: false,
                })

                let subsidiaryValue = objRecord.getValue({fieldId: 'subsidiary'})

                let accountValue = objRecord.getValue({fieldId: 'account'})

                let estimatedtotalvalueValue = objRecord.getValue({fieldId: 'estimatedtotalvalue'})

                let subsidiarySql = `
                select 
                    s.legalname,
                    s.custrecord_eng_subsidiaryname,
                    a.addr1 as mainaddress_addr1,
                    a.addrphone as mainaddress_addrphone,
                    s.fax,
                    c.symbol as currency
                from 
                    Subsidiary as s
                left join
                    SubsidiaryMainAddress as a on a.recordOwner = s.mainaddress
                left join
                    Currency as c on c.id = s.currency
                where 
                    s.legalname is not null
                and 
                    s.id = ${subsidiaryValue}
                `

                let accountSql = `
                select 
                    displaynamewithhierarchy as account 
                from 
                    Account
                where 
                    id = ${accountValue}
                `

                let transactionSql = `
                select 
                    t.tranid as transactionnumber,
                    ia.name as custbody_iareason,
                    t.trandate,
                    d.fullname as department,
                    e.entityid || ' ' || e.altname as entityname, 
                    e1.altname as createdby,
                    t.memo,
                    l.linesequencenumber as line,
                    i.itemid || ' ' || i.displayname as item_display,
                    lo.name as location_display,
                    l.quantity as adjustqtyby,
                    uu.unitname as units_display,
                    l.rate as unitcost,
                    l.memo as dmemo
                from 
                    Transaction as t
                join 
                    TransactionLine as l on t.id = l.transaction
                left join 
                    Department as d on d.id = l.department
                left join 
                    Entity as e on e.id = t.entity
                left join 
                    Entity as e1 on e1.id = t.createdby
                left join 
                    Location as lo on lo.id=l.location
                left join 
                    Item as i on i.id=l.item
                left join
                    UnitsTypeUom as uu on l.units = uu.internalid
                left join 
                    CUSTOMLIST_INVADJREASONLIST as ia on t.custbody_iareason = ia.id
                where 
                    t.id = ${recordId}
                order by 
                    l.linesequencenumber
                `

                let subsidiarySqlResult = getQuerySqlResult(subsidiarySql)

                let transactionSqlResult = getQuerySqlResult(transactionSql)

                let accountSqlResult = getQuerySqlResult(accountSql)

                let paramObj = {
                    "header": {
                        "legalname": nullToEmpty(subsidiarySqlResult.result[0]['legalname']),
                        "custrecord_eng_subsidiaryname": nullToEmpty(subsidiarySqlResult.result[0]['custrecord_eng_subsidiaryname']),
                        "mainaddress_addr1": nullToEmpty(subsidiarySqlResult.result[0]['mainaddress_addr1']),
                        "mainaddress_addrphone": nullToEmpty(subsidiarySqlResult.result[0]['mainaddress_addrphone']),
                        "fax": nullToEmpty(subsidiarySqlResult.result[0]['fax']),
                        "transactionnumber": nullToEmpty(transactionSqlResult.result[0]['transactionnumber']),
                        "custbody_iareason": nullToEmpty(transactionSqlResult.result[0]['custbody_iareason']),
                        "account": nullToEmpty(accountSqlResult.result[0]['account']),
                        "currency": nullToEmpty(subsidiarySqlResult.result[0]['currency']),
                        "estimatedtotalvalue": parseFloat(estimatedtotalvalueValue).toFixed(2),
                        "trandate": nullToEmpty(transactionSqlResult.result[0]['trandate']),
                        "department": nullToEmpty(transactionSqlResult.result[0]['department']),
                        "entityname": nullToEmpty(transactionSqlResult.result[0]['entityname']),
                        "createdby": nullToEmpty(transactionSqlResult.result[0]['createdby']),
                        "memo": nullToEmpty(transactionSqlResult.result[0]['dmemo'])
                    },
                    "body": []
                }

                for (let line = 0; line < objRecord.getLineCount({ sublistId: 'inventory' }); line++) {
                    //INVENTORY DETAIL抓sublist資料轉json
                    let inventoryDetail = JSON.parse(JSON.stringify(objRecord.getSublistSubrecord({ sublistId: 'inventory', line: line, fieldId: 'inventorydetail' })))
                    let details = inventoryDetail['sublists']['inventoryassignment']
                    let inventoryNumberIds = ''
                    let detail = ''

                    //資料表InventoryNumber抓名稱
                    for (let i = 0; i < Object.keys(details).length; i++){
                        if(!details['line '+i]) continue
                        inventoryNumberIds = inventoryNumberIds.concat(', ', details['line '+i]['numberedrecordid'])
                    }

                    let inventoryNumberSql = `
                    select
                        inventorynumber
                    from
                        InventoryNumber
                    where
                        id in (${inventoryNumberIds.substring(1)})
                    `

                    let inventoryDetailSqlResult = getQuerySqlResult(inventoryNumberSql).result

                    for (let i = 0; i < inventoryDetailSqlResult.length; i++) {
                        detail = detail.concat(inventoryDetailSqlResult[i]['inventorynumber'],'(',details['line '+(i+1)]['quantity'],')','<span>\u00A0\u000d</span>')
                    }

                    let bodyObj = {
                        "line": nullToEmpty(transactionSqlResult.result[line+1]['line']),
                        "item_display": nullToEmpty(transactionSqlResult.result[line+1]['item_display']),
                        "location_display": nullToEmpty(transactionSqlResult.result[line+1]['location_display']),
                        "adjustqtyby": nullToEmpty(transactionSqlResult.result[line+1]['adjustqtyby']),
                        "units_display": nullToEmpty(transactionSqlResult.result[line+1]['units_display']),
                        "unitcost": parseFloat(transactionSqlResult.result[line+1]['unitcost']).toFixed(4),
                        "inventorydetail": nullToEmpty(detail),
                        "memo": nullToEmpty(transactionSqlResult.result[line+1]['dmemo'])
                    }

                    paramObj['body'].push(bodyObj)
                }

                //列印
                let domain = url.resolveDomain({hostType: url.HostType.APPLICATION})

                REGULAR_LINK = REGULAR_LINK.replace("$domain", domain).replace("$accountId", runtime.accountId)
                BOLD_LINK = BOLD_LINK.replace("$domain", domain).replace("$accountId", runtime.accountId)
                LIGHT_LINK = LIGHT_LINK.replace("$domain", domain).replace("$accountId", runtime.accountId)

                let fieldNameResult = readConfigFile('zh_CN_1')
                let pdfHeader = createHeaderString(fieldNameResult.result,paramObj.header)
                let contents = createBodyString(fieldNameResult.result, pdfHeader, paramObj.body)
                let xmlStr = createXmlString(contents)
                xmlStr = xmlStr.replaceAll('&','&amp;')

                let pdfFile
                try {
                    pdfFile = render.xmlToPdf({
                        xmlString: xmlStr
                    })
                } catch (e) {
                    log.error(e.name, e.message)
                    return context.response.writePage(errorForm({message: '產生PDF錯誤，錯誤訊息如下:<br>' + e.name + ':' + e.message}, form))
                }

                // log.debug('reamin', runtime.getCurrentScript().getRemainingUsage())
                context.response.writeFile(pdfFile,true)
            }
        }

        /**
         *PDF 表頭
         * @param labelObj 欄位名稱
         * @param headerInfoObj 表頭的值
         * @return {string}
         * "legalname": subsidiarySqlResult.result[0]['legalname'],
         * "custrecord_eng_subsidiaryname": subsidiarySqlResult.result[0]['custrecord_eng_subsidiaryname'],
         * "mainaddress_addr1": subsidiarySqlResult.result[0]['mainaddress_addr1'],
         * "mainaddress_addrphone": subsidiarySqlResult.result[0]['mainaddress_addrphone'],
         * "fax": subsidiarySqlResult.result[0]['fax'],
         * "transactionnumber": transactionSqlResult.result[0]['transactionnumber'],
         * "custbody_iareason": transactionSqlResult.result[0]['custbody_iareason'],
         * "account": accountSqlResult.result[0]['account'],
         * "currency": subsidiarySqlResult.result[0]['currency'],
         * "estimatedtotalvalue": estimatedtotalvalueValue,
         * "trandate": transactionSqlResult.result[0]['trandate'],
         * "department": transactionSqlResult.result[0]['department'],
         * "entityname": transactionSqlResult.result[0]['entityname'],
         * "createdby": transactionSqlResult.result[0]['createdby'],
         * "memo": transactionSqlResult.result[0]['dmemo']
         */
        const createHeaderString = (labelObj,headerInfoObj) => {
            return `<table align='center' style='width: 100%;
border-top-width: 0;border-bottom-width: 0;max-width: 280mm;font-size: 12pt;margin-top:5px;'>  
                    <tr> 
                        <td align='center' colspan='${COLSPAN_ALL}' style='font-size: 28pt;font-weight: lighter'>
                        ${headerInfoObj.legalname}
                        </td>
                    </tr>
                    <tr> 
                        <td align='center' style='font-size:20pt;' colspan='${COLSPAN_ALL}'>
                        ${headerInfoObj.custrecord_eng_subsidiaryname}
                        </td>
                    </tr>
                    <tr> 
                        <td align='center' style='font-size:12pt;' colspan='${COLSPAN_ALL}'>
                        ${headerInfoObj.mainaddress_addr1}
                        </td>
                    </tr>
                    <tr>
                        <td colspan='${COLSPAN_ALL}' style="align: center;">
                        <span style='font-size:12px;'>
                            Tel:${headerInfoObj.mainaddress_addrphone} \u00A0\u00A0 Fax:${headerInfoObj.fax}
                        </span>
                        </td>
                    </tr>
                    <tr>
                        <td align='center' style='font-size:12pt;' colspan='${COLSPAN_ALL}'>
                        <p style='text-align: center'> </p>
                        </td>
                    </tr> 
                    <tr> 
                        <td align='center' style='font-size:18pt;' colspan='${COLSPAN_ALL}'>
                            <u>${labelObj.inventoryadjustment}</u>
                        </td>
                    </tr>
                    <tr>
                        <td align='center' style='font-size:12pt;' colspan='${COLSPAN_ALL}'>
                        <p style='text-align: center'> </p>
                        </td>
                    </tr> 
                    <tr> 
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.transactionnumber} :${headerInfoObj.transactionnumber}   
                        </td>
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.department} :${headerInfoObj.department} 
                        </td>
                    </tr>
                 
                    <tr> 
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.custbody_iareason} : ${headerInfoObj.custbody_iareason} 
                        </td>
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.entityname} : ${headerInfoObj.entityname}
                        </td>
                    </tr>
                    <tr> 
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.account} : ${headerInfoObj.account}
                        </td>
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.creator} : ${headerInfoObj.createdby} 
                        </td>
                    </tr>
                    <tr> 
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.currency} : ${headerInfoObj.currency}
                        </td>
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.estimatedtotalvalue} : ${headerInfoObj.estimatedtotalvalue}
                        </td>
                    </tr>
                    <tr> 
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.trandate} : ${headerInfoObj.trandate} 
                        </td>
                        <td align='left' style='font-size:12pt;' colspan='${COLSPAN_ALL/2}'>
                        ${labelObj.memo} : ${headerInfoObj.memo} 
                        </td>
                    </tr>
                </table>
                `
        }

        /**
         * PDF 表身
         * @param labelObj
         * @param headerStr
         * @param searchResult
         * @return {string}
         */
        const createBodyString = (labelObj, headerStr, searchResult) => {
            let thTextStyle = `text-align: left;padding: 5px;border-top-width: 0;border-left-width: 0;border-right-width: 0;border-bottom-width:0;vertical-align: middle`
            let thNumStyle = thTextStyle.replace('text-align: left', 'text-align: right')
            const tdStyle = `white-space: pre-wrap;font-size: 10pt;word-wrap: break-word;vertical-align:middle;padding: 5px;border-bottom-width:0;border-right-width: 0`;
            //表身內容
            let subListContent = '<tbody>'
            //表身欄位名稱
            let subListTitleStr = `
<table align='left' style='border-collapse: collapse;width: 100%;
max-width: 280mm;font-size: 10pt;word-wrap: break-word;table-layout: fixed;white-space: pre-wrap;'>
    <thead>
        <tr style='background-color:darkgray;border-top-width: 1px;border-bottom-width: 1px'>
            <th colspan='1' style='${thTextStyle.replace('text-align: left', 'text-align: center')}'>${labelObj.line}</th>
            <th align="left" colspan='7' style='${thTextStyle}'>${labelObj.item_display}</th>    
            <th colspan='4' style='${thTextStyle}'>${labelObj.location_display}</th>
            <th align="right" colspan='3' style='${thNumStyle}'>${labelObj.adjustqtyby}</th>
            <th colspan='2' style='${thTextStyle}'>${labelObj.units_display}</th>
            <th align="right" colspan='3' style='${thNumStyle}'>${labelObj.unitcost}</th>
            <th colspan='6' style='${thTextStyle}'>${labelObj.inventorydetail}</th>
            <th colspan='4' style='${thTextStyle}'>${labelObj.memo}</th>
        </tr>
    </thead>`
            //表身欄位資料
            for (let res of searchResult) {
                subListContent += '<tr>'
                let startTag = `<td align="left" colspan='4' style='${tdStyle};text-align: left;vertical-align:text-top;'>`
                let numberTag = `<td align="right" colspan='4' style='${tdStyle};text-align: right;vertical-align:text-top;'>`

                //項次1
                subListContent+=startTag.replace('align="left"', 'align="center"').replace("colspan='4'", "colspan='1'") + res.line + `</td>`
                //項目7
                subListContent += startTag.replace("colspan='4'", "colspan='7'") + res.item_display + `</td>`
                //調整倉庫4
                subListContent += startTag+ res.location_display + `</td>`
                //數量3
                subListContent += numberTag.replace("colspan='4'", "colspan='3'") + res.adjustqtyby + `</td>`
                //單位2
                subListContent += startTag.replace("colspan='4'", "colspan='2'")+ res.units_display + `</td>`
                //單位成本3
                subListContent += numberTag.replace("colspan='4'", "colspan='3'") + res.unitcost + `</td>`
                //序號/批號6
                subListContent += startTag.replace("colspan='4'", "colspan='6'")+ res.inventorydetail + `</td>`
                //備註4
                subListContent += startTag+ res.memo + `</td></tr>`
            }

            subListContent += `</tbody>`

            return headerStr + subListTitleStr + subListContent + '</table>'
            // return headerStr + subListTitleStr + '</table>'
        }

        /**
         * Create XML for PDF
         * @param contentString
         * @param footerString
         * @return {string}
         */
        const createXmlString = (contentString) => {
            return `<?xml version='1.0' encoding='UTF-8'?>
                        <!DOCTYPE pdf PUBLIC '-//big.faceless.org//statement' 'statement-1.1.dtd'>
                            <pdf>
                            <head>
                                <link type='font' name='NotoSans' subtype='TrueType' src='${REGULAR_LINK}' src-bold='${BOLD_LINK}' src-light='${LIGHT_LINK}'/>
                                    <style type='text/css'>
                                        * {
                                            font-family: NotoSans, Arial, sans-serif;
                                            }
                                        body {
                                            font-family: NotoSans, Arial, sans-serif;;
                                            }
                                    </style>
                            </head>
                            <body position='absolute' size='A4-landscape' footer='myfooter' footer-height='4em'>                                 
                                ${contentString}
                            </body>
                            </pdf>`
        }

        /**
         * Read Config file
         * @param{string} languageType
         * @return {{result: {}, message: string, status: number}}
         */
        const readConfigFile = (languageType) => {
            let retValue = {status: 0, result: {}, message: ''}
            let queryRes = getQuerySqlResult(`select top 1 id,name from File where name = '${FILENAME}' and fileType ='JSON';`)

            if (queryRes.status !== 0) {
                return queryRes
            }

            if (queryRes.result.length !== 1) {
                queryRes.status = -89
                queryRes.message = `查無資料，NetSuite中沒有${FILENAME}的設定檔，請先上傳設定檔。`
                return queryRes
            }

            try {
                retValue.result = JSON.parse(file.load({id: queryRes.result[0].id}).getContents())[languageType]
            } catch (e) {
                log.error(e.name + ':' + e.message)
                retValue.status = -99
                retValue.message = e.name + ':' + e.message
                retValue.result = {}
            }
            return retValue
        }

        /**
         * SuiteQL query
         * @param queryString
         * @return {{result: *[], message: string, status: number}}
         */
        const getQuerySqlResult = (queryString) => {
            let returnVal = {
                status: 0,
                result: [],
                message: ''
            };

            let createObj = {
                query: queryString
            };
            // log.debug('sql', queryString)
            try {
                returnVal.result = query.runSuiteQL(createObj).asMappedResults();
            } catch (e) {
                returnVal.status = -99
                returnVal.message = e.name + ':' + e.message
            }

            return returnVal
        }

        /**
         *check null string
         *
         */
        function nullToEmpty(str) {
            return !str?'':str
        }

        return {onRequest}

    });
