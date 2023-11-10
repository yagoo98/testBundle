/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/render', 'N/search', 'N/file', 'N/query', 'N/format', 'N/url', 'N/runtime'],
    /**
     * @param{serverWidget} serverWidget
     * @param{render} render
     * @param {search} search
     * @param {file} file
     * @param {query} query
     * @param {format} format
     * @param {url} url
     * @param {runtime} runtime
     */
    (serverWidget, render, search, file, query, format, url, runtime) => {
        const subsidiarySql = `
                select s.id,
                       s.legalname,s.name as displayname,
                       s.custrecord_eng_subsidiaryname,
                       a.addr1,
                       a.addrphone,
                       s.fax
                from subsidiary as s
                         join
                     SubsidiaryMainAddress as a on a.recordOwner = s.mainaddress
                where s.legalname is not null
                `
        const customerSql = `
                select distinct a.id,
                       a.entityid,
                       a.entitytitle,
                      a.companyName as companyname,NVL(c.attention,'') as attention,NVL(c.addrPhone,'') as addrphone
                from customer as a
                left join customerAddressbook as b on  a.id = b.entity
                left join customerAddressbookEntityAddress as c on b.addressbookaddress = c.nkey
                where a.entityid is not null and b.defaultBilling ='T' 
               `
        const currencySql = "select id,symbol from currency order by id;"
        const FILENAME = "pdf_col_translation.json"
        const ITEM_EXTERNAL_ID = "CUSTOMERDEPOSIT"

        //PDF字體
        let REGULAR_LINK = "https://$domain/c.$accountId/suiteapp/com.fnitech.dynachemv202311/FniUtil/Fonts/NotoSansSC-Regular.ttf"
        let BOLD_LINK = "https://$domain/c.$accountId/suiteapp/com.fnitech.dynachemv202311/FniUtil/Fonts/NotoSansSC-Bold.ttf"
        let LIGHT_LINK = "https://$domain/c.$accountId/suiteapp/com.fnitech.dynachemv202311/FniUtil/Fonts/NotoSansSC-Light.ttf"
        // const MingLiU(細明體),
        // DFKai-sb(標楷體),
        // HeiseiMin,
        // heiseikakugo,
        // Helvetica (Helvetica（赫爾維提卡體，意為「瑞士的」）是一種廣泛使用於拉丁字母的無襯線字體，),
        // Arial"
        //simsun(宋體)
        /**
         * 合併的欄位數量
         * @type {number}
         */
        let COLSPAN_ALL = 34
        //總稅額
        let TAX_SUBTOTAL = 0
        //稅前總額
        let PER_TAX_SUBTOTAL = 0
        //ItemId 開關
        let showItemId = false

        const onRequest = (context) => {
            let form = serverWidget.createForm({
                title: '客戶對帳單',
                id: "custpage_statement_acc"
            })

            if (context.request.method === 'GET') {
                let domain = url.resolveDomain({hostType: url.HostType.APPLICATION})

                showItemId = Boolean(runtime.getCurrentScript().getParameter({name: "custscript_fni_show_itemid"}))

                REGULAR_LINK = REGULAR_LINK.replace("$domain", domain).replace("$accountId", runtime.accountId)
                BOLD_LINK = BOLD_LINK.replace("$domain", domain).replace("$accountId", runtime.accountId)
                LIGHT_LINK = LIGHT_LINK.replace("$domain", domain).replace("$accountId", runtime.accountId)
                log.debug("REGULAR_LINK", REGULAR_LINK)
                let subsidiarySqlResult = getQuerySqlResult(subsidiarySql)
                if (subsidiarySqlResult.status !== 0) {
                    context.response.writePage(errorForm(subsidiarySqlResult))
                }

                let customerSqlResult = getQuerySqlResult(customerSql)
                if (customerSqlResult.status !== 0) {
                    context.response.writePage(errorForm(customerSqlResult))
                }
                let requestParams = context.request.parameters

                if (!requestParams.hasOwnProperty("lan") || !requestParams.lan) {
                    context.response.writePage(writeOnloadPage(form, customerSqlResult.result, subsidiarySqlResult.result, requestParams))
                } else {
                    log.debug("requestParams", JSON.stringify(requestParams))

                    let validateResult = validateRequestParams(requestParams)
                    if (validateResult.status !== 0) {
                        return context.response.writePage(errorForm(validateResult, form))
                    }

                    let paramObjRes = buildInputParams(requestParams)

                    if (!paramObjRes || paramObjRes.status !== 0) {
                        if (!paramObjRes) {
                            paramObjRes = {status: -99, message: "發生異常錯誤"}
                        }
                        return context.response.writePage(errorForm(paramObjRes, form))
                    }

                    let searchResult = searchRecords(paramObjRes.result)
                    log.debug("searchResult", JSON.stringify(searchResult))
                    if (!searchResult || searchResult.status !== 0) {
                        return context.response.writePage(errorForm(searchResult, form))
                    }

                    let fieldNameResult = readConfigFile(requestParams.lan)
                    log.debug("fieldNameResult", JSON.stringify(fieldNameResult))
                    if (fieldNameResult.status !== 0) {
                        return context.response.writePage(errorForm(fieldNameResult, form))
                    }

                    log.debug("labelObj", JSON.stringify(fieldNameResult.result))

                    let footerString = createFooterString(fieldNameResult.result, paramObjRes.result.fax)
                    let pdfHeader = createHeaderString(fieldNameResult.result, paramObjRes.result)
                    let contents = createBodyString(fieldNameResult.result, pdfHeader, searchResult.result)
                    contents = contents.replaceAll("&", "&amp;")

                    //產生pdf的xml
                    let xmlStr = createXmlString(contents, footerString)

                    // try {
                    //     file.create({
                    //         fileType: file.Type.PLAINTEXT,
                    //         folder: 16,
                    //         name: "pdfXML.txt",
                    //         contents: xmlStr
                    //     }).save()
                    // } catch (e) {
                    //     log.error("create pdfXML.txt Error", e.name + ":" + e.message)
                    // }

                    let pdfFile
                    try {
                        pdfFile = render.xmlToPdf({
                            xmlString: xmlStr
                        })
                    } catch (e) {
                        log.error(e.name, e.message)
                        return context.response.writePage(errorForm({message: "產生PDF錯誤，錯誤訊息如下:<br>" + e.name + ":" + e.message}, form))
                    }

                    log.debug("reamin", runtime.getCurrentScript().getRemainingUsage())
                    context.response.writeFile(pdfFile);
                }
            }
        }

        /**
         * 篩選條件欄位畫面
         * @param form
         * @param customerSqlResult
         * @param subsidiarySqlResult
         * @param paramObject
         * @return {form} form
         */
        const writeOnloadPage = (form, customerSqlResult, subsidiarySqlResult, paramObject) => {
            form.clientScriptModulePath = "./_ffdy_ip06_cs_pdf202311.js"
            let curDateField = form.addField({
                id: "curdate",
                type: serverWidget.FieldType.DATE,
                label: "隱藏當前日期",
                container: "filter"
            }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN})
            curDateField.defaultValue = date_format(new Date())

            let thisYear = new Date(curDateField.defaultValue).getFullYear().toString()
            let thisMonth = (new Date(curDateField.defaultValue).getMonth() + 1).toString()
            let currencySQLResult = getQuerySqlResult(currencySql)
            if (currencySQLResult.status !== 0) {
                return errorForm(currencySQLResult)
            }

            form.addFieldGroup({
                id: "filter",
                label: "Filter Criteria"
            })

            form.addFieldGroup({
                id: "period",
                label: "Accounting Period"
            })

            let subsidiary = form.addField({
                id: 'req_subsidiary',
                type: serverWidget.FieldType.SELECT,
                label: '子公司',
                container: "filter"
            })

            let req_start = form.addField({
                id: 'req_start',
                type: serverWidget.FieldType.DATE,
                label: '交易日區間(起)',
                container: "filter"
            })

            let req_end = form.addField({
                id: 'req_end',
                type: serverWidget.FieldType.DATE,
                label: '交易日區間(迄)',
                container: "filter"
            })

            let customer = form.addField({
                id: 'req_customer',
                type: serverWidget.FieldType.SELECT,
                label: '客戶',
                container: "filter"
            })

            //子公司下拉
            for (let req of subsidiarySqlResult) {
                subsidiary.addSelectOption({
                    value: req.id,
                    text: req.displayname,
                    isSelected: false
                })
            }

            subsidiary.addSelectOption({
                value: 0,
                text: "--請選擇--",
                isSelected: true
            })

            customer.addSelectOption({
                value: 0,
                text: "--請選擇--",
                isSelected: true
            })

            //客戶下拉
            for (let req of customerSqlResult) {
                // customerId; entitytitle
                customer.addSelectOption({
                    value: req.id,
                    text: req.entitytitle,
                    isSelected: false
                })
            }

            let req_currency = form.addField({
                id: 'req_currency',
                type: serverWidget.FieldType.SELECT,
                label: '幣別',
                container: "filter"
            })

            //幣別下拉
            for (let sym of currencySQLResult.result) {
                req_currency.addSelectOption({
                    value: sym.id,
                    text: sym.symbol,
                    isSelected: sym.symbol === "TWD"
                })
            }

            let req_year = form.addField({
                id: 'req_year',
                type: serverWidget.FieldType.TEXT,
                label: '對帳單年',
                container: "period"
            })

            let req_month = form.addField({
                id: 'req_month',
                type: serverWidget.FieldType.TEXT,
                label: '對帳單月',
                container: "period"
            })

            req_year.maxLength = 4
            req_month.maxLength = 2
            subsidiary.isMandatory = true
            customer.isMandatory = true
            req_currency.isMandatory = true
            req_year.isMandatory = true
            req_month.isMandatory = true
            req_start.isMandatory = true
            req_end.isMandatory = true

            subsidiary.defaultValue = paramObject.sub ? parseInt(paramObject.sub) : null;
            customer.defaultValue = paramObject.cust ? parseInt(paramObject.cust) : null;
            req_currency.defaultValue = paramObject.symbol ? parseInt(paramObject.symbol) : 1
            req_year.defaultValue = paramObject.y ? parseInt(paramObject.y) : thisYear
            req_month.defaultValue = paramObject.m ? parseInt(paramObject.m) : thisMonth
            req_start.defaultValue = paramObject.hasOwnProperty("sd") && paramObject.sd ? paramObject.sd : date_format(new Date());
            req_end.defaultValue = paramObject.hasOwnProperty("ed") && paramObject.ed ? paramObject.ed : date_format(new Date());

            let paramObj = {
                curDate: curDateField.defaultValue,
                symbol: req_currency.defaultValue,
                cust: customer.defaultValue,
                sub: subsidiary.defaultValue,
                dateFrom: req_start.defaultValue,
                dateTo: req_end.defaultValue,
                y: req_year.defaultValue,
                m: req_month.defaultValue,
                lan: "zh_TW"
            }

            form.addButton({
                label: "繁中列印",
                id: "tradition",
                functionName: `identifyLanguage(${JSON.stringify(paramObj)})`
            })

            paramObj.lan = "zh_CN"
            form.addButton({
                label: "簡中列印",
                id: "simple",
                functionName: `identifyLanguage(${JSON.stringify(paramObj)})`
            })
            return form
        }

        /**
         * 檢查傳入參數
         * @param params
         * @return {{result: {}, message: string, status: number}}
         */
        const validateRequestParams = (params) => {
            let retValue = {status: 0, message: "呼叫時，傳入資料錯誤:", result: {}}
            const NumberFields = ["sub", "symbol", "cust", "y", "m"]
            const OtherMandatoryFields = ["curDate", "dateTo", "dateFrom", "lan"]
            const labelParam = {
                "sub": "子公司",
                "symbol": "幣別",
                "cust": "客戶",
                "y": "對帳單年",
                "m": "對帳單月",
                "dateFrom": "交易日區間(起)",
                "dateTo": "交易日區間(迄)",
                "lan": "列印語言",
                "curDate": "系統時間"
            }
            for (let i in params) {
                if (NumberFields.indexOf(i) > -1 && (!params[i] || isNaN(parseInt(params[i])) || parseInt(params[i]) === 0)) {
                    retValue.status = -89
                    retValue.message += `${labelParam[i]}沒有值`
                    return retValue
                }

                if (OtherMandatoryFields.indexOf(i) > -1 && !params[i].trim()) {
                    retValue.status = -89
                    retValue.message += `${labelParam[i]}沒有值`
                    return retValue
                }
            }
            return retValue
        }

        /**
         * 整理傳入參數
         * @param params
         * @return {{result: {}, message: string, status: number}}
         */
        const buildInputParams = (params) => {
            let retValue = {status: 0, message: "", result: {}}
            let subsidiarySqlResult
            let customerSqlResult
            let paramObj = {
                currency: parseInt(params.symbol),
                customer: parseInt(params.cust),
                subsidiary: parseInt(params.sub),
                curDate: params.curDate,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                accYear: params.y,
                accMonth: params.m,
                lan: params.lan
            }
            subsidiarySqlResult = getQuerySqlResult(subsidiarySql + `and s.id = ${paramObj.subsidiary};`)
            customerSqlResult = getQuerySqlResult(customerSql + ` and a.id =${paramObj.customer};`)

            if (subsidiarySqlResult.status !== 0) {
                retValue.status = subsidiarySqlResult.status
                retValue.message = subsidiarySqlResult.message
                return retValue
            }

            if (customerSqlResult.status !== 0) {
                retValue.status = customerSqlResult.status
                retValue.message = customerSqlResult.message
                return retValue
            }

            if (subsidiarySqlResult.result.length !== 1 || customerSqlResult.result.length !== 1) {
                retValue.status = -89
                retValue.message = `子公司找無內部ID=${paramObj.subsidiary} or 客戶找無內部ID=${paramObj.customer}的資料`
                return retValue
            }

            let subsidiaryField = subsidiarySqlResult.result.find(it => it.id === paramObj.subsidiary)
            let customerField = customerSqlResult.result.find(it => it.id === paramObj.customer)

            paramObj["legalname"] = subsidiaryField.legalname !== null && subsidiaryField.legalname !== "" ? subsidiaryField.legalname : "";
            paramObj["custrecord_eng_subsidiaryname"] = subsidiaryField.custrecord_eng_subsidiaryname !== null && subsidiaryField.custrecord_eng_subsidiaryname !== "" ? subsidiaryField.custrecord_eng_subsidiaryname : ""
            paramObj["addr1"] = subsidiaryField.addr1 !== null && subsidiaryField.addr1 !== "" ? subsidiaryField.addr1 : "";
            paramObj["addrphone"] = subsidiaryField.addrphone !== null && subsidiaryField.addrphone !== "" ? subsidiaryField.addrphone : ""
            paramObj["fax"] = subsidiaryField.fax !== null && subsidiaryField.fax !== "" ? subsidiaryField.fax : ""
            paramObj["customerno"] = customerField.entityid !== null && customerField.entityid !== "" ? customerField.entityid : ""
            paramObj["customername"] = customerField.companyname !== null && customerField.companyname !== "" ? customerField.companyname : ""
            paramObj["attention"] = customerField.attention !== null && customerField.attention !== "" ? customerField.attention : ""
            paramObj["contact"] = customerField.addrphone !== null && customerField.addrphone !== "" ? customerField.addrphone : ""

            retValue.result = paramObj
            return retValue
        }

        /**
         * 查詢單據，表身資料
         * @param inputObj
         * @return {{result: *[], message: string, status: number}}
         */
        const searchRecords = (inputObj) => {
            PER_TAX_SUBTOTAL = 0
            TAX_SUBTOTAL = 0
            let searchSoTranIdSQLResult
            let querySOIdSQL = `select id,tranid from transaction where recordType ='salesorder' and id in (`

            let salesOrderIdArray = []
            let restValue = {status: 0, message: "", result: []}
            const textColumnArray = ["currency", "terms", "item"]
            let filterArray = [
                ["type", "anyof", "CustInvc", "CustCred"],
                "AND",
                ["mainline", "is", "F"],
                "AND",
                ["item.type", "anyof", "InvtPart", "Discount", "Service", "NonInvtPart"],
                "AND",
                ["status", "anyof", "CustInvc:A", "CustInvc:B", "CustCred:B", "CustCred:A"],
                "AND",
                ["custbody_customerstatement", "is", "T"],
                "AND",
                "NOT",
                [["item.externalid", "anyof", ITEM_EXTERNAL_ID], "AND", ["amount", "greaterthan", "0.00"]],
                "AND",
                "NOT",
                ["totalamount", "equalto", "0.00"],
                "AND",
                ["accounttype", "noneof", "OthCurrAsset", "COGS"],
                "AND",
                ["customer.internalidnumber", search.Operator.EQUALTO, inputObj.customer],
                "AND",
                ["custbody_statementdate", search.Operator.WITHIN, inputObj.dateFrom, inputObj.dateTo],
                "AND",
                ["currency.internalidnumber", search.Operator.EQUALTO, inputObj.currency],
                "AND",
                ["subsidiary.internalidnumber", search.Operator.EQUALTO, inputObj.subsidiary]
            ]

            let colArray = [
                "recordtype",
                "shipdate",
                "custbody_createdif",
                "type",
                "tranid",
                "createdfrom",
                "custbody_guis09",
                "entity",
                "custcol_customerso",
                "item",
                search.createColumn({
                    name: "displayname",
                    join: "item"
                }),
                "quantityuom",
                "currency",
                "fxrate",
                "fxamount",
                search.createColumn({
                    name: "formulanumeric",
                    formula: "ROUND({fxamount}*{taxitem.rate}/100,2)",
                    label: "taxamount"
                }),
                "terms"
            ]

            try {
                search.create({
                    type: "transaction",
                    filters: filterArray,
                    columns: colArray
                }).run().each(function (object) {
                    let resultObj = {}
                    object.columns.forEach(function (column) {
                        let columnName = column.name;
                        if (column.hasOwnProperty("label") && column.label) {
                            columnName = column.label;
                        }
                        if (textColumnArray.includes(columnName)) {
                            resultObj[columnName] = object.getText(column);
                        } else {
                            resultObj[columnName] = object.getValue(column);
                        }

                        if (columnName === "createdfrom" && resultObj[columnName] && salesOrderIdArray.indexOf(parseInt(resultObj[columnName])) <= 0) {
                            salesOrderIdArray.push(parseInt(resultObj[columnName]))
                        }

                        if (!resultObj[columnName]) {
                            resultObj[columnName] = "-"
                        }

                    })
                    restValue.result.push(resultObj)
                    return true
                })
            } catch (e) {
                log.error(e.name, e.message)
                restValue.message = "Search Error. Message:" + e.name + ":" + e.message
                restValue.status = -99
                return restValue
            }

            if (restValue.result.length < 1) {
                restValue.status = 1
                restValue.message = `查無資料。篩選條件:Customer:${inputObj.customer};Currency:${inputObj.currency};subsidiary:${inputObj.subsidiary};
                dateFrom:${inputObj.dateFrom};dateTo:${inputObj.dateTo}`
                return restValue
            }
            //
            // try {
            //     file.create({
            //         fileType: file.Type.JSON,
            //         folder: 16,
            //         name: "searchResult01.json",
            //         contents: JSON.stringify(restValue.result)
            //     }).save()
            // } catch (e) {
            //     log.error("create pdfXML.txt Error", e.name + ":" + e.message)
            // }

            if (salesOrderIdArray.length >= 1) {
                for (let soId of salesOrderIdArray) {
                    querySOIdSQL += soId + ","
                }

                querySOIdSQL = querySOIdSQL.substring(0, querySOIdSQL.lastIndexOf(",")) + ") order by id;"
                // log.debug("querySOIdSQL", querySOIdSQL)
                searchSoTranIdSQLResult = getQuerySqlResult(querySOIdSQL)
                if (searchSoTranIdSQLResult.status !== 0) {
                    restValue.status = -99
                    restValue.message = searchSoTranIdSQLResult.message
                    return restValue
                }

                if (searchSoTranIdSQLResult.result.length < 1) {
                    restValue.status = -99
                    restValue.message = "查無對應SO單據資料，internalidArray :" + salesOrderIdArray.toString()
                    return restValue
                }
            }

            let invoicetranIdArray = []
            let tranIdArray = []

            for (let res of restValue.result) {
                res["shipping_no"] = "-"

                if (searchSoTranIdSQLResult && searchSoTranIdSQLResult.result.length >= 1) {
                    let findSO = searchSoTranIdSQLResult.result.find(it => it.id === parseInt(res.createdfrom))
                    if (!findSO) {
                        res.createdfrom = "-"
                    } else {
                        res.createdfrom = findSO.tranid
                    }
                } else {
                    res.createdfrom = "-"
                }

                if (res.displayname) {
                    if (showItemId) {
                        res.item = res.item + " " + res.displayname.trim()
                    } else {
                        res.item = res.displayname.trim()
                    }
                }

                if (res.item.length > 100) {
                    res.item = res.item.substring(0, res.item.charCodeAt(101)) + "..."
                }

                if (res.fxrate && !isNaN(Number(res.fxrate))) {
                    res.fxrate = formatNumberWithCommas(Number(Number(res.fxrate).toFixed(2)))
                }

                if (tranIdArray.indexOf(res.tranid)) {
                    tranIdArray.push(res.tranid)
                }

                if (res.shipdate && !isNaN(new Date(res.shipdate))) {
                    let shipDate = new Date(res.shipdate)
                    res.shipdate = shipDate.getFullYear() + "-" + (shipDate.getMonth() + 1).toString().padStart(2, "0") + "-" + (shipDate.getDate()).toString().padStart(2, "0")
                }

                if (res.quantityuom && !isNaN(Number(res.quantityuom))) {
                    res.quantityuom = Number(res.quantityuom)
                }

                if (res.recordtype === "invoice") {
                    if (res.item.includes("預收貨款")) {
                        res.shipdate = "-"
                    }
                    if (res.tranid && res.tranid !== "-" && invoicetranIdArray.indexOf(res.tranid) < 0) {
                        invoicetranIdArray.push(res.tranid)
                    }

                    if (res.quantity && !isNaN(Number(res.quantity))) {
                        res.quantity = Math.round(Number(res.quantity) * 100) / 100
                    }

                    if (res.fxamount && !isNaN(Number(res.fxamount))) {
                        res.fxamount = Math.round(Number(res.fxamount) * 100) / 100
                    }

                    if (res.taxamount && !isNaN(Number(res.taxamount))) {
                        res.taxamount = Math.round(Number(res.taxamount) * 100) / 100
                    }
                } else {
                    if (res.fxamount && !isNaN(Number(res.fxamount))) {
                        res.fxamount = Math.round(Math.abs(Number(res.fxamount)) * 100) / 100 * -1
                    }

                    if (res.taxamount && !isNaN(Number(res.taxamount))) {
                        res.taxamount = Math.round(Math.abs(Number(res.taxamount)) * 100) / 100 * -1
                    }

                    res.createdfrom = "-"
                }

                PER_TAX_SUBTOTAL += Number(res.fxamount)
                TAX_SUBTOTAL += Number(res.taxamount)
            }

            let queryInvoiceCreateIfSQL = "select tranid,custbody_createdif from Transaction where recordType = 'invoice' and tranid in ("
            let querySOSql = "select distinct A.id,A.tranid,A.custbody_createdif,A.recordType as recordtype," +
                "BUILTIN.DF(B.custcol_customerso) as custcol_customerso, B.custcol_customerso as soid,BUILTIN.DF(B.item) as itemname," +
                "B.item as itemid,(select displayname from Item where id =B.item) as subitemname " +
                " from transaction as A " +
                "left join transactionLine as B on A.id = B.transaction " +
                " where B.item is not null and A.tranid in ("

            for (let tran of invoicetranIdArray) {
                queryInvoiceCreateIfSQL += `'${tran}',`
            }

            for (let tran of tranIdArray) {
                querySOSql += `'${tran}',`
            }

            querySOSql = querySOSql.substring(0, querySOSql.lastIndexOf(",")) + ") order by A.id;"

            if (invoicetranIdArray.length > 0) {
                queryInvoiceCreateIfSQL = queryInvoiceCreateIfSQL.substring(0, queryInvoiceCreateIfSQL.lastIndexOf(",")) + ")"

                let queryInvoiceResults = getQuerySqlResult(queryInvoiceCreateIfSQL)
                if (queryInvoiceResults.status !== 0) {
                    restValue.status = -99
                    restValue.message = queryInvoiceResults.message
                    log.error(queryInvoiceResults.status, queryInvoiceResults.message)
                    return restValue
                }
                log.debug("queryInvoiceResults", JSON.stringify(queryInvoiceResults.result))
                if (queryInvoiceResults.result.length !== invoicetranIdArray.length) {
                    restValue.status = -99
                    restValue.message = "資料錯誤，找無對應" + invoicetranIdArray.toString() + "的資料"
                    log.error("queryInvoiceResults Error", restValue.message)
                    return restValue
                }

                for (let res of queryInvoiceResults.result) {
                    let find = restValue.result.find(it => it.tranid === res.tranid)
                    if (find && res.custbody_createdif) {
                        res.shipping_no = res.custbody_createdif
                    }
                }
            }

            let querySoResult = getQuerySqlResult(querySOSql)
            if (querySoResult.status !== 0) {
                restValue.status = -99
                restValue.message = querySoResult.message
                return restValue
            }

            if (querySoResult.result.length < 1) {
                restValue.status = -99
                restValue.message = "資料錯誤，" + querySOSql + "查詢結果與Saved Search 不同，Saved Search 結果:" + tranIdArray.toString()
                log.error("querySoResult error", restValue.message)
                return restValue
            }
            log.debug('querySoResult', JSON.stringify(querySoResult.result))
            //客戶訂單號、合同號、出貨單號
            for (let res of restValue.result) {
                let find = querySoResult.result.find(it => it.tranid === res.tranid)
                if (!find) {
                    restValue.status = -99
                    restValue.message = "找無資料，查無文件號碼:" + res.tranid
                    return restValue
                }

                if (res.custcol_customerso !== find.custcol_customerso && res.custcol_customerso === "-" && !res.custcol_customerso && find.custcol_customerso) {
                    res.custcol_customerso = find.custcol_customerso
                }

                if (find.recordtype === "invoice" && !find.itemname.includes("預收貨款") && res.shipping_no === "-" && find.custbody_createdif) {
                    res.shipping_no = find.custbody_createdif
                } else {
                    res.shipping_no = "-"
                }
            }

            restValue.result = restValue.result.sort((a, b) => {
                    if (a.shipdate !== b.shipdate) {
                        return a.shipdate - b.shipdate
                    } else if (a.createdfrom !== b.createdfrom) {
                        return a.createdfrom - b.createdfrom
                    } else if (a.item !== b.item) {
                        return a.item - b.item
                    } else {
                        return 0
                    }
                }
            )
            //
            // try {
            //     file.create({
            //         fileType: file.Type.JSON,
            //         folder: 16,
            //         name: "searchResult02.json",
            //         contents: JSON.stringify(restValue.result)
            //     }).save()
            // } catch (e) {
            //     log.error("create pdfXML.txt Error", e.name + ":" + e.message)
            // }
            return restValue
        }

        /**
         * Read Config file
         * @param{string} languageType
         * @return {{result: {}, message: string, status: number}}
         */
        const readConfigFile = (languageType) => {
            let retValue = {status: 0, result: {}, message: ""}
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
                log.error(e.name + ":" + e.message)
                retValue.status = -99
                retValue.message = e.name + ":" + e.message
                retValue.result = {}
            }
            return retValue
        }

        /**
         *PDF 表頭
         * @param labelObj 欄位名稱
         * @param headerInfoObj 表頭的直
         * @return {string}
         */
        const createHeaderString = (labelObj, headerInfoObj) => {
            let today = new Date(headerInfoObj.curDate)
            let start = new Date(headerInfoObj.dateFrom)
            let end = new Date(headerInfoObj.dateTo)
            let statDate = start.getFullYear() + "/" + (start.getMonth() + 1).toString().padStart(2, "0") + "/" + (start.getDate()).toString().padStart(2, "0")
            let endDate = end.getFullYear() + "/" + (end.getMonth() + 1).toString().padStart(2, "0") + "/" + (end.getDate()).toString().padStart(2, "0")

            return `<table align='center' style='width: 100%;
border-top-width: 0;border-bottom-width: 0;max-width: 280mm;font-size: 12px;margin-top:5px;'>  
                    <tr> 
                        <td align='center' colspan='${COLSPAN_ALL}' style="font-size: 28px;">
                        ${headerInfoObj.legalname}
                        </td>
                    </tr>
                    <tr> 
                        <td align='center' style='font-size:20px;' colspan='${COLSPAN_ALL}'>
                      ${headerInfoObj.custrecord_eng_subsidiaryname}
                        </td>
                    </tr>
                    <tr> 
                        <td align='center' style='font-size:12px;' colspan='${COLSPAN_ALL}'>
                       ${headerInfoObj.addr1}
                        </td>
                    </tr>
                    <tr> 
                        <td align='center' style='font-size:12px;' colspan='${COLSPAN_ALL}'>
                        ${labelObj.contact_phone}:${headerInfoObj.addrphone} ${labelObj.contact_fax}:${headerInfoObj.fax}
                        </td>
                    </tr>
                    <tr>
                        <td align='center' style='font-size:12px;' colspan='${COLSPAN_ALL}'>
                        <p style='text-align: center'> </p>
                        </td>
                    </tr>
                    <tr> 
                        <td align='center' style='font-size:18px;' colspan='${COLSPAN_ALL}'>
                     <u>${headerInfoObj.accYear} 年 ${headerInfoObj.accMonth} 月 ${labelObj.statement}</u>
                        </td>
                    </tr>
                    <tr> 
                       <td align='right' style='font-size:12px;margin-left:85%' >                       
						日期：${today.getFullYear().toString() + "-" + (today.getMonth() + 1).toString().padStart(2, "0") + "-" + (today.getDate()).toString().padStart(2, "0")}
                        </td>         
                    </tr>
                    <tr> 
                        <td align='left' style='font-size:12px;' colspan='0'>
                       ${labelObj.trade_region}： ${statDate}－${endDate}
                        </td>
                    </tr>
                 
                    <tr> 
                        <td align='left' style='font-size:12px;' colspan='${COLSPAN_ALL}'>
                       ${labelObj.customer_no}： ${headerInfoObj.customerno}
                        </td>
                    </tr>
                    <tr> 
                        <td align='left' style='font-size:12px;' colspan='${COLSPAN_ALL}'>
                       ${labelObj.customer_name}： ${headerInfoObj.customername}
                        </td>
                    </tr>
                    <tr> 
                        <td align='left' style='font-size:12px;' colspan='${COLSPAN_ALL}'>
                      ${labelObj.contact_person}： ${headerInfoObj.attention} ${labelObj.contact} : ${headerInfoObj.contact}
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
            let thNumStyle = thTextStyle.replace("text-align: left", "text-align: right")
            const tdStyle = `white-space: pre-wrap;font-size: 8pt;word-wrap: break-word;vertical-align:middle;padding: 5px;border-bottom-width:0;border-right-width: 0`;
            //表身內容
            let subListContent = "<tbody>"
            //表身欄位名稱
            let subListTitleStr = `
<table align='left' style="border-collapse: collapse;width: 100%;
max-width: 280mm;font-size: 8pt;word-wrap: break-word;table-layout: fixed;white-space: pre-wrap;">
    <thead>
        <tr style="background-color:darkgray;border-top-width: 1px;border-bottom-width: 1px">
            <th colspan="2" style="${thTextStyle}">${labelObj.ship_date}</th>
            <th colspan="3" style="${thTextStyle}">${labelObj.shipping_no}</th>
            <th colspan="1" style="${thTextStyle.replace("padding: 5px", "padding: 2px")}">${labelObj.acctype}</th>
            <th colspan="3" style="${thTextStyle}">${labelObj.contract_no}</th>
            <th colspan="3" style="${thTextStyle}">${labelObj.invoice_number}</th>
            <th colspan="3" style="${thTextStyle}">${labelObj.customer_order_no}</th>
            <th colspan="6" style="${thTextStyle}">${labelObj.item}</th>
            <th colspan="2" style="${thNumStyle}" align="right">${labelObj.quantity}</th>
            <th colspan="1" style="${thTextStyle.replace("padding: 5px", "padding: 2px")}">${labelObj.currency}</th>
            <th colspan="2" style="${thNumStyle}" align="right">${labelObj.unit_price}</th>
            <th colspan="3" style="${thNumStyle}" align="right">${labelObj.amount}</th>
            <th colspan="3" style="${thNumStyle}" align="right">${labelObj.tax_amount}</th>
            <th colspan="2" style="${thTextStyle}" align="left">${labelObj.terms}</th>
        </tr>
    </thead>`
            //表身欄位資料
            for (let res of searchResult) {
                subListContent += "<tr>"
                let startTag = `<td align='left' colspan='2' style='${tdStyle};text-align: left;'>`
                let numberTag = `<td align='right' colspan='2' style='${tdStyle};text-align: right;'>`
                let docNoTag = startTag.replace("colspan='2'", "colspan='3'")
                //帳別
                let accType = ""
                if (res.recordtype === "invoice") {
                    accType = labelObj.invoicetype
                } else {
                    accType = labelObj.creditmemotype
                }

                //出貨日期、出貨單號
                subListContent += startTag.replace("white-space: pre-wrap", "white-space:nowrap;").replace("padding: 5px", "padding: 0px") + res.shipdate.trim() + `</td>
                                  ${docNoTag}${res.shipping_no}</td>`
                //帳別
                subListContent += startTag.replace("colspan='2'", "colspan='1'").replace("padding: 5px", "padding: 2px") + `${accType}</td>`
                //合同號、銷項憑證號碼、客戶訂單號
                subListContent += `${docNoTag}${res.createdfrom}</td>${docNoTag}${res.custbody_guis09}</td>${docNoTag}${res.custcol_customerso}</td>`
                //品名規格
                subListContent += startTag.replace("colspan='2'", "colspan='6'") + res.item + `</td>`
                //數量
                subListContent += numberTag + formatNumberWithCommas(res.quantityuom) + `</td>`
                //幣別
                subListContent += `${startTag.replace("colspan='2'", "colspan='1'").replace("padding: 5px", "padding: 2px")}${res.currency}</td>`
                //單價、金額、稅額
                subListContent += numberTag + res.fxrate + "</td>" +
                    numberTag.replace("colspan='2'", "colspan='3'") + formatNumberWithCommas(res.fxamount) + "</td>" +
                    numberTag.replace("colspan='2'", "colspan='3'") + formatNumberWithCommas(res.taxamount) + "</td>"
                //付款條件
                let terms = "-"
                if (res.terms && res.terms.indexOf("）") > -1) {
                    terms = res.terms.trim().substring(res.terms.indexOf("）") + 1, res.terms.length)
                }
                subListContent += startTag + terms + "</td></tr>"
            }

            subListContent += `<tr style="border-top-width: 1px;font-size: 12px">
                                   <td colspan="5" style="padding: 3px;">${labelObj.pretax_subtotal}:</td>
                                   <td colspan="6" style="padding: 3px;">${formatNumberWithCommas(PER_TAX_SUBTOTAL)}</td>
                                   <td colspan="5" style="padding: 3px;">${labelObj.tax_subtotal}：</td>
                                   <td colspan="6" style="padding: 3px;">${formatNumberWithCommas(TAX_SUBTOTAL)}</td>
                                   <td colspan="5" style="padding: 2px;"><b>${labelObj.sum}:</b></td>
                                   <td colspan="7" style="padding: 3px;text-align: right;" align="right"><b>${formatNumberWithCommas(PER_TAX_SUBTOTAL + TAX_SUBTOTAL)}</b></td>
                               </tr>
                            </tbody>`

            return headerStr + subListTitleStr + subListContent + "</table>"
        }

        /**
         * 建立頁尾
         * @param {Object} labelObj 翻譯設定檔
         * @param {string} fax 傳真
         * @return {String}
         */
        const createFooterString = (labelObj, fax) => {
            const styleStr = "padding: 5px;border-width: 0;text-align: left;"
            return `<table style="width:100%;">
                                             <tr style="border-bottom-width: 0;border-top-width: 0">
                                                <td colspan="${COLSPAN_ALL - 1}"/>     
                                                 <td colspan='1' align="left" style="${styleStr}">${labelObj.end_01.trim()}:${fax}</td>    
                                             </tr>
                                                <tr style="border-bottom-width: 0;">
                                                      <td colspan="${COLSPAN_ALL - 1}"/>  
                                                      <td colspan="1" align="left" style="${styleStr}">${labelObj.end_02.trim()}</td>
                                                </tr>                                               
                                                <tr>
                                                    <td colspan="${COLSPAN_ALL - 1}" />
                                                    <td colspan="1" align="right" style="text-align:right;font-size: 12px">頁碼: <pagenumber/></td>
                                                </tr>
                                             </table>`
        }

        /**
         * Create XML for PDF
         * @param contentString
         * @param footerString
         * @return {string}
         */
        const createXmlString = (contentString, footerString) => {
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
                                             font-family: NotoSans, Arial, sans-serif;
                                             }
                                     </style>
                                     <macrolist>
                                             <macro id="myfooter">
                                           ${footerString}                                                                             
                                             </macro>
                                          </macrolist>
                                     </head>
                                         <body position='absolute' size="A4-landscape" footer="myfooter" footer-height="4em">                                 
                                             ${contentString}
                                         </body>
                                 </pdf>`
        }

        /**
         *千分位逗號
         * @param {number} number
         * @return {string}
         */
        const formatNumberWithCommas = (number) => {
            return format.format({
                value: number,
                type: format.Type.CURRENCY
            })
        }

        /**
         * 日期時間轉換成台北時區 UTC+8
         * @param {Date} inundate
         * @return {*}
         */
        const date_format = (inundate) => {
            if (!inundate) {
                inundate = new Date()
            }
            return format.parse({
                value: inundate,
                type: format.Type.DATE,
                timezone: format.Timezone.ASIA_TAIPEI
            })

        }

        /**
         * Create Error Form
         * @param errorMessageObject
         * @param errForm
         * @return {*}
         */
        const errorForm = (errorMessageObject, errForm) => {
            errForm.addFieldGroup({id: "custpage_egroup", label: "有錯誤發生，請看以下錯誤訊息:"})
            errForm.addField({
                id: "err_message",
                label: "錯誤訊息",
                type: serverWidget.FieldType.TEXTAREA,
                container: "egroup"
            }).updateDisplayType({displayType: serverWidget.FieldDisplayType.READONLY}
            ).updateLayoutType({layoutType: serverWidget.FieldLayoutType.OUTSIDE}
            ).updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL}
            ).defaultValue = errorMessageObject.message

            return errForm
        }

        // const findFileURL = (fieldName, folderName, domain) => {
        //     let sql = `select * from file where `
        //
        //     // let loadFile = file.load({
        //     //     id: 2881
        //     // })
        //
        //     // let initialURL = loadFile.url
        //     // let finalURL = domain + initialURL
        //     // log.debug("finalURL", finalURL)
        //     return ""
        // }

        /**
         * SuiteQL query
         * @param queryString
         * @return {{result: *[], message: string, status: number}}
         */
        const getQuerySqlResult = (queryString) => {
            let returnVal = {
                status: 0,
                result: [],
                message: ""
            };

            let createObj = {
                query: queryString
            };
            log.debug("sql", queryString)
            try {
                returnVal.result = query.runSuiteQL(createObj).asMappedResults();
            } catch (e) {
                returnVal.status = -99
                returnVal.message = e.name + ":" + e.message
            }

            return returnVal
        }

        return {onRequest}
    })