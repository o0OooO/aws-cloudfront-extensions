import http
import json
import logging
import os
import uuid
from typing import Any

from functions.acm_import_cb.types_ import Event
from layer.acm_service.client import AcmUtilsService
from layer.acm_service.types_ import ImportCertificateInput, Tag, CertificateMetadata, NotificationInput
from layer.cloudfront_service.client import CloudFrontUtilsService
from layer.common.cert_utils import get_domain_list_from_cert
from layer.common.file_utils import convert_string_to_file
from layer.common.response import Response
from layer.job_service.client import JobInfoUtilsService
from layer.sns_service.client import SnsUtilsService

logger = logging.getLogger('boto3:acm_import_cb')
logger.setLevel(logging.INFO)
acm_client = AcmUtilsService(logger=logger)
cloudfront_client = CloudFrontUtilsService(logger=logger)
sns_client = SnsUtilsService(logger=logger)
job_info_client = JobInfoUtilsService(logger=logger)

FILE_FOLDER = '/tmp'
PEM_FILE = FILE_FOLDER + "/cert.pem"
_GET_FILE = lambda x: open(os.path.join(FILE_FOLDER, x), "rb").read()
# get sns topic arn from environment variable
sns_topic_arn = os.environ.get('SNS_TOPIC')
task_type = os.getenv('TASK_TYPE')


def handler(event: Event, context: Any) -> Response:
    logger.info("Received event: " + json.dumps(event, indent=2, default=str))

    task_token = event['task_token']

    domain_name_list = event['input']['cnameList']

    task_token = acm_client.check_generate_task_token(task_token)
    job_token = event['input']['aws_request_id']

    try:
        cloudfront_client.validate_source_cloudfront_dist(domain_name_list)

        # iterate pemList array from event
        for pem_index, pem_value in enumerate(event['input']['pemList']):
            cert_uuid = str(uuid.uuid4())
            convert_string_to_file(pem_value['CertPem'], PEM_FILE)
            _domainList = get_domain_list_from_cert(PEM_FILE, logger)
            domain_name = (_domainList[0] if _domainList else '').replace('*.', '')

            certificate = ImportCertificateInput(
                Certificate=str.encode(pem_value['CertPem']),
                CertificateChain=str.encode(pem_value['ChainPem']),
                PrivateKey=str.encode(pem_value['PrivateKeyPem']),
                CertificateArn='',
                Tags=[Tag(
                    Key='issuer',
                    Value=domain_name,
                )]
            )
            cert_arn = acm_client.import_certificate_by_pem(certificate)

            logger.info('index %s: sanList for DynamoDB: %s', pem_index, json.dumps(_domainList, default=str))

            acm_client.create_acm_metadata(CertificateMetadata(
                domainName=domain_name,
                sanList=_domainList,
                certUUid=cert_uuid,
                certArn=cert_arn,
                taskToken=task_token,
                taskType=task_type,
                taskStatus='TASK_TOKEN_TAGGED',
                jobToken=job_token,
            ))

            # tag acm certificate with task_token, slice task token to fit length of 128
            acm_client.tag_certificate(cert_arn, task_token[:128])
            acm_client.tag_job_certificate(cert_arn, job_token)

        job_info_client.update_job_fields_by_dict(job_token, {
            'certCreateStageStatus': 'SUCCESS',
            'certValidationStageStatus': 'INPROGRESS'
        })

        cloudfront_dist = []
        for record in event['input']['fn_acm_cb_handler_map']:
            cloudfront_dist.append(NotificationInput(
                distributionDomainName=record['fn_cloudfront_bind']['Payload']['body']['distributionDomainName'],
                distributionArn=record['fn_cloudfront_bind']['Payload']['body']['distributionArn'],
                aliases=record['fn_cloudfront_bind']['Payload']['body']['aliases'],
            ))
        msg = acm_client.get_distribution_msg(cloudfront_distributions=cloudfront_dist)
        sns_client.publish_by_topic(topic_arn=sns_topic_arn,
                                    msg=json.dumps(msg, indent=2, default=str),
                                    subject='SSL for SaaS event received')
        return Response(statusCode=http.HTTPStatus.OK, body=json.dumps('step to acm import callback complete'))
    except Exception as e:
        logger.error("Exception occurred, just update the ddb table")
        job_info_client.update_job_fields_by_dict(job_token, {
            'certCreateStageStatus': 'FAILED',
            'promptInfo': str(e)
        })
        raise e
