/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NAmdConfig ./config.json
 */
define(['FNI/logLib'],
    /**
     * @param logLib
     */
    (logLib) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            let recordId = scriptContext.request.parameters.recordId
            logLib.inputParamLog(recordId);
            //WOW So Itithcy
            var html = '<html><body><h1>Hello World</h1></body></html>';
            scriptContext.response.write(html);

        }

        {}

        return {onRequest}

    });
