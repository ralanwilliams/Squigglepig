Pod::Spec.new do |s|
  s.name           = 'ScreenPin'
  s.version        = '1.0.0'
  s.summary        = "Squigglepig's lock for the endless hunt: whether Guided Access is on"
  s.description    = "Squigglepig's lock for the endless hunt: whether Guided Access is on"
  s.author         = 'Squigglepig'
  s.homepage       = 'https://squigglepig.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'Proprietary' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
