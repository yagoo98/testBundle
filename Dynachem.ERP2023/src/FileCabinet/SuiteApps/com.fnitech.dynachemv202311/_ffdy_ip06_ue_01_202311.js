/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/query'],
    /**
     * @param{query} query
     */
    (query) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         * @param {string} context.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} context.form - Current form
         * @param {ServletRequest} context.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (context) => {

            let curRecord = context.newRecord
            let curForm = context.form
            let createdIfForm = curForm.getField("custbody_createdif")
            let entryformquerystring = curRecord.getValue("entryformquerystring")
            log.debug("entryformquerystring", entryformquerystring)
            if (!entryformquerystring || entryformquerystring.indexOf("&itemship=") < 0) {
                log.debug("沒找到itemship", "不動作")
                return
            }
            let itemShip = entryformquerystring.substring(entryformquerystring.indexOf("&itemship=") + 1, entryformquerystring.length)

            if (itemShip && !createdIfForm) {
                return `<h1>發生異常錯誤，請聯絡丰益顧問。</h1><br><h5>錯誤訊息:未設定出貨單欄位，請先設定</h5>`
            }

            if (itemShip.indexOf("itemship=") > -1) {
                itemShip = itemShip.substring(itemShip.indexOf("=") + 1, itemShip.length)
            }

            let sql = `select id,tranid from transaction where recordType ='itemfulfillment' and id =${parseInt(itemShip)};`
            let queryResult = getQuerySqlResult(sql)
            log.debug("queryResult", JSON.stringify(queryResult.result))
            if (queryResult.status !== 0) {
                return `<h1>發生異常錯誤，請聯絡工程師。</h1><br><h5>錯誤訊息:${queryResult.message}</h5>`
            }

            if (queryResult.result.length < 1) {
                return `<h1>發生異常錯誤，請聯絡工程師。</h1><br><h5>錯誤訊息:查無出貨單號，內部ID=${itemShip};</h5>`
            }

            try {
                curRecord.setValue("custbody_createdif", queryResult.result[0].tranid)
            } catch (e) {
                log.error("SetValue Error", e.name + ":" + e.message)
                return `<h1>發生異常錯誤，請聯絡工程師。</h1><br><h5>錯誤訊息:${e.name + ":" + e.message}</h5>`
            }
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

        return {beforeLoad}

    });
