/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([],
    /**
     */
    () => {
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
            if(context.type === context.UserEventType.EDIT ||context.type === context.UserEventType.VIEW){
                try {
                    context.form.addButton({
                        id: "custpage_printzhcn",
                        label: "簡中列印",
                        functionName: `onclick_printZHCN()`
                    })
                    context.form.clientScriptModulePath = "./_ffdy_iav202311_cs.js"
                } catch(e) {
                    log.debug({title: 'unable to add button', details: "發生異常錯誤，請聯絡工程師。錯誤訊息:"+e.name + ":" + e.message})
                }
            }
        }
        return {beforeLoad}
    });
