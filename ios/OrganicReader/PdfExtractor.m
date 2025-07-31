#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PdfExtractor, NSObject)

RCT_EXTERN_METHOD(extractText:(NSString *)fileUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getPageCount:(NSString *)fileUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end