/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/url'],
    /**
     * @param{url} url
     */
    function (url) {
        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} context
         * @param {Record} context.currentRecord - Current form record
         * @param {string} context.sublistId - Sublist name
         * @param {string} context.fieldId - Field name
         * @param {number} context.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} context.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(context) {
            let curRecord = context.currentRecord
            let subsidiary = curRecord.getValue("req_subsidiary")
            let customer = curRecord.getValue("req_customer")
            let req_sdate = curRecord.getText("req_start")
            let req_edate = curRecord.getText("req_end")
            let req_currency = curRecord.getValue("req_currency")
            let req_year = curRecord.getValue("req_year")
            let req_month = curRecord.getValue("req_month")

            let ped = curRecord.getValue("ped")

            let paramObj = {}
            if (subsidiary) {
                paramObj["sub"] = subsidiary
            }

            if (req_sdate) {
                paramObj["sd"] = req_sdate
            }

            if (req_edate) {
                paramObj["ed"] = req_edate
            }
            if (req_currency) {
                paramObj["symbol"] = req_currency
            }

            if (customer) {
                paramObj["cust"] = customer
            }

            if (req_year) {
                paramObj["y"] = req_year
            }

            if (req_month) {
                paramObj["m"] = req_month
            }

            if (ped) {
                paramObj["ped"] = ped
            }

            try {
                window.onbeforeunload = null
                window.onbeforeprint = null
                window.open(getScriptUrl(paramObj), "_self")
                return true
            } catch (e) {
                alert(e.name + ":" + e.message)
                return false
            }
        }

        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} context
         * @param {Record} context.currentRecord - Current form record
         * @param {string} context.sublistId - Sublist name
         * @param {string} context.fieldId - Field name
         *
         * @since 2015.2
         */
        function identifyLanguage(context) {
            try {
                window.onbeforeunload = null
                window.onbeforeprint = null
                window.open(getScriptUrl(context), "_self")
                return true
            } catch (e) {
                alert(e.name + ":" + e.message)
                return false
            }
        }

        /**
         * @return {string} link
         */
        function getScriptUrl(paramObj) {
            let urlObj = {
                scriptId: "customscript_ffdy_ip06_sl_pdf202310",
                deploymentId: "customdeploy_ffdy_ip06_sl_pdf202310",
                returnExternalUrl: false
            }
            if (paramObj) {
                urlObj["params"] = paramObj
            }
            try {
                return url.resolveScript(urlObj)
            } catch (e) {
                alert("ex:" + e.toString())
            }
        }


        return {
            fieldChanged: fieldChanged,
            identifyLanguage: identifyLanguage
        };

    });
