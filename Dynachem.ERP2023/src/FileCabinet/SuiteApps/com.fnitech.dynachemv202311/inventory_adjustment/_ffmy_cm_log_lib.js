/**
 * @NApiVersion 2.1
 */
define([],

    () => {
        /**
         * log input value while error occurred
         * @param {string | Object} requestBody
         */
        const inputParamLog = (requestBody) => {
            log.error({
                title: "requestBody",
                details: requestBody
            });
        }

        /**
         * exception log
         * @param {string} functionName
         * @param {Object} ex
         */
        const executionExceptionLog = (functionName, ex) => {
            log.error({
                title: "function " + functionName,
                details: ex.name + ": " + ex.message
            });
        }

        const logNewRecordId = (recordType, id) => {
            log.audit({
                title: "單據建立成功",
                details: recordType + ", 內部ID為" + id
            });
        }

        const logUpdatedRecordId = (recordType, id) => {
            log.audit({
                title: "單據編輯成功",
                details: recordType + ", 內部ID為" + id
            });
        }

        return {
            inputParamLog,
            executionExceptionLog,
            logNewRecordId,
            logUpdatedRecordId
        }
    });